import { Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SYSTEM_ROLES, type IDeviceInfo } from '@common';
import { USER_STATUS, type IAuthResult } from '@contracts/auth';
import type { AccountEntity } from '@auth/entities';
import { AuditLogBuilder } from '@auth/builders';
import type { AuditLogService, ITokenLifecycleService, TokenPair } from '@auth/services/infrastructure';
import type { AuthFlowContext, AuthProvisionResult, IAuthSaga } from '@auth/templates/auth-flow.interface';

/**
 * Abstract Template Class defining the Template Method for all authentication and registration flows.
 *
 * Implements the GoF Template Method Pattern:
 * The template method `execute(...)` defines the invariant skeleton of the authentication process,
 * delegating specific primitive steps (credentials validation, provisioning, post-actions, events)
 * to concrete flow subclasses.
 *
 * Invariant Flow Sequence:
 * 1. authenticateOrProvision(dto, deviceInfo) -> returns { account, saga, clientIp, lastLoginAt }
 * 2. resolveRoles(account) -> returns roles array
 * 3. generateTokens(account, roles, deviceInfo, saga) -> generates token pair & registers with saga (fail-fast)
 * 4. onSuccess(context) -> subclass-specific side effects (DB update, outbox, cache clear)
 * 5. recordAudit(context) -> fire-and-forget structured audit log
 * 6. emitSuccessEvent(context) -> domain event emission
 * 7. buildAuthResult(context) -> returns standardized IAuthResult
 *
 * Error & Compensation:
 * In case of any exception after saga instantiation, saga.rollback() is invoked to execute
 * compensating transactions, followed by emitFailureEvent() and rethrowing the original error.
 */
export abstract class AbstractAuthFlow<TDto, TSaga extends IAuthSaga = IAuthSaga> {
   protected readonly logger = new Logger(this.constructor.name);

   constructor(
      protected readonly tokenLifecycleService: ITokenLifecycleService,
      protected readonly auditLogService: AuditLogService,
      protected readonly eventEmitter: EventEmitter2,
   ) {}

   /**
    * The Template Method: Orchestrates the overall authentication workflow.
    */
   public async execute(dto: TDto, deviceInfo?: IDeviceInfo): Promise<IAuthResult> {
      const startTime = Date.now();
      let activeSaga: TSaga | undefined;
      let resolvedClientIp = 'unknown';

      try {
         // Step 1: Primitive operation - Validate credentials or provision new account
         const provisionResult = await this.authenticateOrProvision(dto, deviceInfo);
         activeSaga = provisionResult.saga;
         const account = provisionResult.account;
         resolvedClientIp = provisionResult.clientIp ?? this.extractClientIp(dto, deviceInfo);

         // Step 2: Hook operation - Resolve & cache roles
         const roles = await this.resolveRoles(account);

         // Step 3: Concrete invariant operation - Issue tokens with fail-fast semantics
         const tokens = await this.generateTokens(account, roles, deviceInfo, activeSaga);

         const context: AuthFlowContext<TDto, TSaga> = {
            dto,
            deviceInfo,
            clientIp: resolvedClientIp,
            account,
            roles,
            tokens,
            saga: activeSaga,
            startTime,
            lastLoginAt: provisionResult.lastLoginAt ?? account.lastLoginAt ?? null,
         };

         // Step 4: Primitive operation - Post-authentication actions
         await this.onSuccess(context);

         if (activeSaga?.complete) {
            await activeSaga.complete();
         }

         // Step 5: Hook operation - Audit logging
         this.recordAudit(context);

         // Step 6: Primitive operation - Emit domain success event
         this.emitSuccessEvent(context);

         // Step 7: Concrete invariant operation - Construct standard output payload
         return this.buildAuthResult(context);
      } catch (error: unknown) {
         if (activeSaga) {
            await activeSaga.rollback();
         }
         this.onFailure(error, dto, deviceInfo, resolvedClientIp);
         throw error;
      }
   }

   // Abstract Primitive Operations (Required)

   /**
    * Validates credentials or performs account registration and creates the saga instance.
    */
   protected abstract authenticateOrProvision(dto: TDto, deviceInfo?: IDeviceInfo): Promise<AuthProvisionResult<TSaga>>;

   /**
    * Executes flow-specific post-success persistence or side effects.
    */
   protected abstract onSuccess(context: AuthFlowContext<TDto, TSaga>): Promise<void>;

   /**
    * Emits the appropriate domain success event.
    */
   protected abstract emitSuccessEvent(context: AuthFlowContext<TDto, TSaga>): void;

   /**
    * Emits the appropriate domain failure event.
    */
   protected abstract emitFailureEvent(error: unknown, dto: TDto, deviceInfo?: IDeviceInfo, clientIp?: string): void;

   /**
    * Returns the action string identifier for the audit log.
    */
   protected abstract getAuditAction(): string;

   // Concrete / Hook Operations (Overridable)

   /**
    * Hook: Resolves the account roles, defaulting to [SYSTEM_ROLES.USER] if none present.
    */
   protected resolveRoles(account: AccountEntity): Promise<string[]> {
      return Promise.resolve(account.roles && account.roles.length > 0 ? account.roles : [SYSTEM_ROLES.USER]);
   }

   /**
    * Invariant: Generates access and refresh tokens and registers them in the saga.
    */
   protected async generateTokens(
      account: AccountEntity,
      roles: string[],
      deviceInfo?: IDeviceInfo,
      saga?: TSaga,
   ): Promise<TokenPair> {
      const tokens = await this.tokenLifecycleService.generateTokenPair(
         {
            accountId: account.accountId,
            email: account.email,
            roles,
         },
         deviceInfo,
      );
      saga?.setTokens(tokens);
      return tokens;
   }

   /**
    * Hook: Dispatches structured audit log in a non-blocking (fire-and-forget) manner.
    */
   protected recordAudit(context: AuthFlowContext<TDto, TSaga>): void {
      this.auditLogService
         .record(
            AuditLogBuilder.create()
               .withAction(this.getAuditAction())
               .asSuccess()
               .withAccount(context.account)
               .withIpAddress(context.clientIp)
               .withDeviceInfo(context.deviceInfo)
               .withMetadata({ roles: context.roles })
               .build(),
         )
         .catch((err: unknown) => {
            this.logger.error(`Failed to record audit log for ${this.getAuditAction()} (non-blocking)`, err);
         });
   }

   /**
    * Hook: Handles failure by delegating to emitFailureEvent.
    */
   protected onFailure(error: unknown, dto: TDto, deviceInfo?: IDeviceInfo, clientIp?: string): void {
      this.emitFailureEvent(error, dto, deviceInfo, clientIp);
   }

   /**
    * Helper: Extracts failure error code or message from an exception.
    */
   protected extractFailureReason(error: unknown): string {
      if (
         error &&
         typeof error === 'object' &&
         'errorCode' in error &&
         typeof (error as { errorCode?: unknown }).errorCode === 'string'
      ) {
         return (error as { errorCode: string }).errorCode;
      }
      if (error instanceof Error) {
         return error.message;
      }
      return 'unknown';
   }

   /**
    * Helper: Resolves client IP address from request metadata or DTO.
    */
   protected extractClientIp(dto: unknown, deviceInfo?: IDeviceInfo): string {
      const dtoWithIp = dto as { ip?: string };
      return deviceInfo?.ipAddress || dtoWithIp?.ip?.trim() || 'unknown';
   }

   /**
    * Invariant: Builds standardized IAuthResult output.
    */
   protected buildAuthResult(context: AuthFlowContext<TDto, TSaga>): IAuthResult {
      const { account, roles, tokens, lastLoginAt } = context;
      return {
         user: {
            userId: account.accountId,
            email: account.email,
            roles,
            status: account.status || USER_STATUS.ACTIVE,
            isEmailVerified: account.isEmailVerified ?? false,
            lastLoginAt: lastLoginAt ?? null,
            createdAt: account.createdAt,
            updatedAt: account.updatedAt,
         },
         accessToken: tokens.accessToken,
         refreshToken: tokens.refreshToken,
      };
   }
}
