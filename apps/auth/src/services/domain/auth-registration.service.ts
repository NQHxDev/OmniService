import { Inject, Injectable, Optional } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SAGA_REPOSITORY, type ISagaRepository } from '@common/saga';
import { BadRequestException, OtpUtil, RedisService, RbacCacheService, UnauthorizedException } from '@common';
import {
   AUDIT_ACTIONS,
   AUTH_AGGREGATES,
   AUTH_ERROR_CODES,
   AUTH_RESPONSE_MESSAGES,
   AUTH_SECURITY,
   USER_STATUS,
   RegisterDto,
   SendRegisterOtpDto,
   type SendRegisterOtpResponseDto,
   VerifyRegisterOtpDto,
   type VerifyRegisterOtpResponseDto,
   type IAuthResult,
} from '@contracts/auth';
import { NOTIFICATION_EVENTS } from '@contracts/notification';
import { NOTIFICATION_ADAPTER, type INotificationAdapter } from '@auth/adapters';
import { SYSTEM_ROLES, type IDeviceInfo } from '@common';
import { ACCOUNT_REPOSITORY, type IAccountRepository, RBAC_REPOSITORY, type IRbacRepository } from '@auth/repositories';
import { AuditLogBuilder } from '@auth/builders/audit-log.builder';
import { AuthConfigService } from '@auth/config';
import { OUTBOX_REPOSITORY, type IOutboxRepository } from '@auth/outbox/repositories/outbox.repository.interface';
import { UNIT_OF_WORK, type IUnitOfWork } from '@auth/unit-of-work';
import {
   AUTH_RATE_LIMITER,
   type IAuthRateLimiter,
   AuditLogService,
   EmailBloomFilterService,
   TOKEN_LIFECYCLE_SERVICE,
   VERIFICATION_TOKEN_SERVICE,
} from '@auth/services/infrastructure';
import { AUTH_METRICS_OTP_OPERATIONS, AUTH_METRICS_OTP_TYPES, AUTH_REDIS_TTL, AuthRedisKeys } from '@auth/constants';
import {
   PASSWORD_HASHER,
   type IPasswordHasher,
   type ITokenLifecycleService,
   type IVerificationTokenService,
} from '@auth/services/infrastructure';
import type { RoleEntity, AccountEntity } from '@auth/entities';
import { RegisterSaga } from '@auth/sagas';
import { Email, Password, VerificationToken } from '@auth/domain/value-objects';
import {
   AUTH_DOMAIN_EVENTS,
   OtpFailedEvent,
   OtpGeneratedEvent,
   OtpVerifiedEvent,
   UserRegisteredEvent,
   UserRegistrationFailedEvent,
} from '@auth/domain/events';
import { AbstractAuthFlow, type AuthFlowContext, type AuthProvisionResult } from '@auth/templates';

export interface RegistrationFlowDto extends RegisterDto {
   targetRole?: string;
   outboxEventType?: string;
}

/**
 * AuthRegistrationService handles account registration, verification tokens, and OTP verification.
 * Implements the concrete Template Method operations derived from AbstractAuthFlow.
 */
@Injectable()
export class AuthRegistrationService extends AbstractAuthFlow<RegistrationFlowDto, RegisterSaga> {
   constructor(
      @Inject(ACCOUNT_REPOSITORY)
      private readonly accountRepository: IAccountRepository,
      @Inject(RBAC_REPOSITORY)
      private readonly rbacRepository: IRbacRepository,
      @Inject(OUTBOX_REPOSITORY)
      private readonly outboxRepository: IOutboxRepository,
      @Inject(UNIT_OF_WORK)
      private readonly unitOfWork: IUnitOfWork,
      private readonly rbacCacheService: RbacCacheService,
      @Inject(VERIFICATION_TOKEN_SERVICE)
      private readonly verificationTokenService: IVerificationTokenService,
      @Inject(TOKEN_LIFECYCLE_SERVICE)
      tokenLifecycleService: ITokenLifecycleService,
      @Inject(PASSWORD_HASHER)
      private readonly passwordHasher: IPasswordHasher,
      @Inject(AUTH_RATE_LIMITER)
      private readonly rateLimiter: IAuthRateLimiter,
      private readonly emailBloomFilterService: EmailBloomFilterService,
      private readonly redisService: RedisService,
      auditLogService: AuditLogService,
      @Inject(NOTIFICATION_ADAPTER)
      private readonly notificationAdapter: INotificationAdapter,
      private readonly config: AuthConfigService,
      eventEmitter: EventEmitter2,
      @Optional()
      @Inject(SAGA_REPOSITORY)
      private readonly sagaRepository?: ISagaRepository,
   ) {
      super(tokenLifecycleService, auditLogService, eventEmitter);
   }

   private async getOrCacheRole(roleCode: string): Promise<RoleEntity | null> {
      const cached = await this.rbacCacheService.getRole(roleCode);
      if (cached) {
         return cached;
      }

      const role = await this.rbacRepository.findRoleByCode(roleCode);
      if (role) {
         await this.rbacCacheService.setRole(roleCode, {
            roleId: role.roleId,
            code: role.code,
            name: role.name,
            description: role.description,
            permissions: role.permissions || [],
         });
      }

      return role;
   }

   async checkEmail(email: string): Promise<{ available: boolean; email: string }> {
      const emailResult = Email.create(email);
      if (emailResult.isFailure()) {
         throw new BadRequestException(AUTH_ERROR_CODES.INVALID_EMAIL_FORMAT, {
            params: emailResult.getParams(),
         });
      }
      const normalizedEmail = emailResult.getValue().getValue();

      await this.rateLimiter.checkEmail(normalizedEmail);

      const available = await this.emailBloomFilterService.isEmailAvailable(normalizedEmail);
      return { available, email: normalizedEmail };
   }

   async sendRegisterOtp(dto: SendRegisterOtpDto, deviceInfo?: IDeviceInfo): Promise<SendRegisterOtpResponseDto> {
      const startTime = Date.now();
      try {
         const emailResult = Email.create(dto.email);
         if (emailResult.isFailure()) {
            throw new BadRequestException(AUTH_ERROR_CODES.INVALID_EMAIL_FORMAT, {
               params: emailResult.getParams(),
            });
         }
         const normalizedEmail = emailResult.getValue().getValue();

         await this.rateLimiter.checkSendRegisterOtp(normalizedEmail);

         const isAvailable = await this.emailBloomFilterService.isEmailAvailable(normalizedEmail);
         if (!isAvailable) {
            await this.auditLogService.record(
               AuditLogBuilder.create()
                  .withAction(AUDIT_ACTIONS.AUTH_OTP_FAILED)
                  .asFailure(AUTH_ERROR_CODES.EMAIL_ALREADY_EXISTS)
                  .withActorEmail(normalizedEmail)
                  .withDeviceInfo(deviceInfo)
                  .build(),
            );
            throw new BadRequestException(AUTH_ERROR_CODES.EMAIL_ALREADY_EXISTS, {
               params: { email: normalizedEmail },
            });
         }

         const cooldownKey = AuthRedisKeys.registerOtpCooldown(normalizedEmail);
         const remainingCooldown = await this.redisService.ttl(cooldownKey);
         if (remainingCooldown > 0) {
            throw new BadRequestException(AUTH_ERROR_CODES.OTP_COOLDOWN_ACTIVE, {
               params: { remainingSeconds: remainingCooldown },
            });
         }

         const otp = OtpUtil.generate();
         const otpKey = AuthRedisKeys.registerOtp(normalizedEmail);
         const attemptsKey = AuthRedisKeys.registerOtpAttempts(normalizedEmail);

         await Promise.all([
            this.redisService.set(otpKey, otp, AUTH_REDIS_TTL.OTP_REGISTER),
            this.redisService.set(cooldownKey, '1', AUTH_REDIS_TTL.OTP_REGISTER_COOLDOWN),
            this.redisService.del(attemptsKey),
         ]);

         await this.notificationAdapter.sendRegistrationOtp(
            normalizedEmail,
            otp,
            Math.round(AUTH_REDIS_TTL.OTP_REGISTER / 60),
         );

         await this.auditLogService.record(
            AuditLogBuilder.create()
               .withAction(AUDIT_ACTIONS.AUTH_OTP_SENT)
               .asSuccess()
               .withActorEmail(normalizedEmail)
               .withDeviceInfo(deviceInfo)
               .build(),
         );

         this.eventEmitter.emit(
            AUTH_DOMAIN_EVENTS.OTP_GENERATED,
            new OtpGeneratedEvent(AUTH_METRICS_OTP_TYPES.REGISTER, (Date.now() - startTime) / 1000, normalizedEmail),
         );

         return {
            success: true,
            message: AUTH_RESPONSE_MESSAGES.SEND_OTP_SUCCESS,
            cooldownSeconds: AUTH_REDIS_TTL.OTP_REGISTER_COOLDOWN,
            expiresInMinutes: Math.round(AUTH_REDIS_TTL.OTP_REGISTER / 60),
         };
      } catch (error) {
         this.eventEmitter.emit(
            AUTH_DOMAIN_EVENTS.OTP_FAILED,
            new OtpFailedEvent(
               AUTH_METRICS_OTP_OPERATIONS.SEND,
               AUTH_METRICS_OTP_TYPES.REGISTER,
               dto.email,
               error instanceof Error ? error.message : undefined,
            ),
         );
         throw error;
      }
   }

   async verifyRegisterOtp(dto: VerifyRegisterOtpDto, deviceInfo?: IDeviceInfo): Promise<VerifyRegisterOtpResponseDto> {
      const startTime = Date.now();
      try {
         const emailResult = Email.create(dto.email);
         if (emailResult.isFailure()) {
            throw new BadRequestException(AUTH_ERROR_CODES.INVALID_EMAIL_FORMAT, {
               params: emailResult.getParams(),
            });
         }
         const normalizedEmail = emailResult.getValue().getValue();

         await this.rateLimiter.checkVerifyRegisterOtp(normalizedEmail);

         const otpKey = AuthRedisKeys.registerOtp(normalizedEmail);
         const attemptsKey = AuthRedisKeys.registerOtpAttempts(normalizedEmail);

         const storedOtp = await this.redisService.get(otpKey);
         if (!storedOtp) {
            await this.auditLogService.record(
               AuditLogBuilder.create()
                  .withAction(AUDIT_ACTIONS.AUTH_OTP_FAILED)
                  .asFailure(AUTH_ERROR_CODES.OTP_EXPIRED)
                  .withActorEmail(normalizedEmail)
                  .withIpAddress(deviceInfo?.ipAddress)
                  .build(),
            );
            throw new BadRequestException(AUTH_ERROR_CODES.OTP_EXPIRED);
         }

         const attempts = await this.redisService.incr(attemptsKey);
         if (attempts === 1) {
            await this.redisService.expire(attemptsKey, AUTH_REDIS_TTL.OTP_REGISTER);
         }

         if (attempts > AUTH_SECURITY.MAX_OTP_ATTEMPTS) {
            await Promise.all([this.redisService.del(otpKey), this.redisService.del(attemptsKey)]);
            await this.auditLogService.record(
               AuditLogBuilder.create()
                  .withAction(AUDIT_ACTIONS.AUTH_OTP_FAILED)
                  .asFailure(AUTH_ERROR_CODES.OTP_MAX_ATTEMPTS_EXCEEDED)
                  .withActorEmail(normalizedEmail)
                  .withIpAddress(deviceInfo?.ipAddress)
                  .build(),
            );
            throw new BadRequestException(AUTH_ERROR_CODES.OTP_MAX_ATTEMPTS_EXCEEDED);
         }

         if (storedOtp !== dto.otp) {
            await this.auditLogService.record(
               AuditLogBuilder.create()
                  .withAction(AUDIT_ACTIONS.AUTH_OTP_FAILED)
                  .asFailure(AUTH_ERROR_CODES.OTP_INVALID)
                  .withActorEmail(normalizedEmail)
                  .withIpAddress(deviceInfo?.ipAddress)
                  .withMetadata({ remainingAttempts: AUTH_SECURITY.MAX_OTP_ATTEMPTS - attempts })
                  .build(),
            );

            throw new BadRequestException(AUTH_ERROR_CODES.OTP_INVALID, {
               params: { remainingAttempts: AUTH_SECURITY.MAX_OTP_ATTEMPTS - attempts },
            });
         }

         const verificationToken = await this.verificationTokenService.generate(
            normalizedEmail,
            AUTH_REDIS_TTL.OTP_VERIFICATION_TOKEN,
         );

         await Promise.all([this.redisService.del(otpKey), this.redisService.del(attemptsKey)]);

         await this.auditLogService.record(
            AuditLogBuilder.create()
               .withAction(AUDIT_ACTIONS.AUTH_OTP_VERIFIED)
               .asSuccess()
               .withActorEmail(normalizedEmail)
               .withDeviceInfo(deviceInfo)
               .build(),
         );

         this.eventEmitter.emit(
            AUTH_DOMAIN_EVENTS.OTP_VERIFIED,
            new OtpVerifiedEvent(AUTH_METRICS_OTP_TYPES.REGISTER, (Date.now() - startTime) / 1000, dto.email),
         );

         return {
            success: true,
            verificationToken,
            expiresInSeconds: AUTH_REDIS_TTL.OTP_VERIFICATION_TOKEN,
         };
      } catch (error) {
         this.eventEmitter.emit(
            AUTH_DOMAIN_EVENTS.OTP_FAILED,
            new OtpFailedEvent(
               AUTH_METRICS_OTP_OPERATIONS.VERIFY,
               AUTH_METRICS_OTP_TYPES.REGISTER,
               dto.email,
               error instanceof Error ? error.message : undefined,
            ),
         );
         throw error;
      }
   }

   /**
    * Public entry point for user registration.
    * Executes the Template Method defined in AbstractAuthFlow.
    */
   async register(dto: RegisterDto, deviceInfo?: IDeviceInfo): Promise<IAuthResult> {
      return this.execute(
         {
            ...dto,
            targetRole: SYSTEM_ROLES.USER,
            outboxEventType: NOTIFICATION_EVENTS.USER_REGISTERED,
         },
         deviceInfo,
      );
   }

   /**
    * Primitive step: Validates registration payload, hashes password, executes transaction, and prepares saga.
    */
   protected async authenticateOrProvision(
      dto: RegistrationFlowDto,
      deviceInfo?: IDeviceInfo,
   ): Promise<AuthProvisionResult<RegisterSaga>> {
      const emailResult = Email.create(dto.email);
      if (emailResult.isFailure()) {
         throw new BadRequestException(AUTH_ERROR_CODES.INVALID_EMAIL_FORMAT, {
            params: emailResult.getParams(),
         });
      }
      const email = emailResult.getValue();
      const normalizedEmail = email.getValue();

      let isEmailVerified = false;
      if (dto.verificationToken) {
         const tokenResult = VerificationToken.create(dto.verificationToken);
         if (tokenResult.isFailure()) {
            throw new BadRequestException(AUTH_ERROR_CODES.INVALID_VERIFICATION_TOKEN, {
               params: tokenResult.getParams(),
            });
         }
         const verificationToken = tokenResult.getValue();

         const storedEmail = await this.verificationTokenService.consume(verificationToken.getValue());
         if (!storedEmail) {
            throw new UnauthorizedException(AUTH_ERROR_CODES.VERIFICATION_TOKEN_EXPIRED);
         }

         const storedEmailVO = Email.create(storedEmail);
         if (storedEmailVO.isFailure() || !email.equals(storedEmailVO.getValue())) {
            throw new BadRequestException(AUTH_ERROR_CODES.EMAIL_MISMATCH);
         }
         isEmailVerified = true;
      }

      const passwordResult = Password.create(dto.password);
      if (passwordResult.isFailure()) {
         throw new BadRequestException(AUTH_ERROR_CODES.WEAK_PASSWORD, {
            params: passwordResult.getParams(),
         });
      }
      const password = passwordResult.getValue();

      const mightContain = await this.emailBloomFilterService.mightContain(normalizedEmail);
      if (mightContain) {
         const existing = await this.accountRepository.findByEmail(normalizedEmail);
         if (existing && existing.status !== USER_STATUS.REGISTRATION_ABORTED) {
            await this.auditLogService.record(
               AuditLogBuilder.create()
                  .withAction(AUDIT_ACTIONS.AUTH_REGISTER)
                  .asFailure(AUTH_ERROR_CODES.EMAIL_ALREADY_EXISTS)
                  .withActorEmail(normalizedEmail)
                  .withDeviceInfo(deviceInfo)
                  .build(),
            );
            throw new BadRequestException(AUTH_ERROR_CODES.EMAIL_ALREADY_EXISTS, {
               params: { email: normalizedEmail },
            });
         }
      }

      const targetRoleName = dto.targetRole ?? SYSTEM_ROLES.USER;
      const [defaultRole, passwordHash] = await Promise.all([
         this.getOrCacheRole(targetRoleName),
         password.hash(this.passwordHasher),
      ]);

      const saga = new RegisterSaga(
         this.accountRepository,
         this.tokenLifecycleService,
         this.outboxRepository,
         this.sagaRepository,
      );

      const eventType = dto.outboxEventType ?? NOTIFICATION_EVENTS.USER_REGISTERED;
      const initialStatus = isEmailVerified ? USER_STATUS.ACTIVE : USER_STATUS.PENDING_ACTIVATION;

      const newAccount = await this.unitOfWork.runInTransaction(async (uow) => {
         await uow.accountRepository.deleteAbortedByEmail(normalizedEmail);

         const account = await uow.accountRepository.create({
            email: normalizedEmail,
            passwordHash,
            roleId: defaultRole?.roleId,
            status: initialStatus,
            isEmailVerified,
         });

         await uow.outboxRepository.create({
            aggregateType: AUTH_AGGREGATES.ACCOUNT,
            aggregateId: account.accountId,
            eventType,
            payload: {
               email: normalizedEmail,
               accountId: account.accountId,
               role: targetRoleName,
            },
         });

         return account;
      });
      await saga.setAccount(newAccount);

      return {
         account: newAccount,
         saga,
         clientIp: this.extractClientIp(dto, deviceInfo),
      };
   }

   /**
    * Hook: Resolves roles and warms the RBAC cache.
    */
   protected override async resolveRoles(account: AccountEntity): Promise<string[]> {
      const accountRoles = await super.resolveRoles(account);
      await Promise.all(accountRoles.map((role) => this.getOrCacheRole(role)));
      return accountRoles;
   }

   /**
    * Primitive step: Adds email to bloom filter and triggers outbox event publisher.
    */
   protected async onSuccess(context: AuthFlowContext<RegistrationFlowDto, RegisterSaga>): Promise<void> {
      const normalizedEmail = context.account.email;
      await this.emailBloomFilterService.addEmail(normalizedEmail);
      this.logger.log(`Created account ${context.account.email} with transactional Outbox event; streamed via CDC`);
   }

   /**
    * Hook: Identifies audit action for registration success.
    */
   protected getAuditAction(): string {
      return AUDIT_ACTIONS.AUTH_REGISTER;
   }

   /**
    * Hook: Dispatches structured audit log with context-aware action identifier.
    */
   protected override recordAudit(context: AuthFlowContext<RegistrationFlowDto, RegisterSaga>): void {
      this.auditLogService
         .record(
            AuditLogBuilder.create()
               .withAction(this.getAuditAction())
               .asSuccess()
               .withAccount(context.account)
               .withDeviceInfo(context.deviceInfo)
               .withIpAddress(context.clientIp)
               .build(),
         )
         .catch((err: unknown) => {
            this.logger.error('Failed to write audit log in registration flow', err);
         });
   }

   /**
    * Primitive step: Emits domain event for registration.
    */
   protected emitSuccessEvent(context: AuthFlowContext<RegistrationFlowDto, RegisterSaga>): void {
      this.eventEmitter.emit(
         AUTH_DOMAIN_EVENTS.USER_REGISTERED,
         new UserRegisteredEvent(context.account.accountId, context.account.email, new Date(), context.deviceInfo),
      );
   }

   /**
    * Primitive step: Emits domain event for registration failure.
    */
   protected emitFailureEvent(error: unknown, dto: RegistrationFlowDto, deviceInfo?: IDeviceInfo): void {
      const reason = this.extractFailureReason(error);
      this.eventEmitter.emit(
         AUTH_DOMAIN_EVENTS.USER_REGISTRATION_FAILED,
         new UserRegistrationFailedEvent(dto.email, reason, new Date(), deviceInfo),
      );
   }
}
