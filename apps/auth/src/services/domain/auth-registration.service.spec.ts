import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RbacCacheService, RedisService, SYSTEM_ROLES, UnauthorizedException } from '@common';
import { NOTIFICATION_ADAPTER } from '@auth/adapters';
import { AUTH_AGGREGATES, AUTH_ERROR_CODES, USER_STATUS } from '@contracts/auth';
import { NOTIFICATION_EVENTS } from '@contracts/notification';
import { AuthRegistrationService } from '@auth/services/domain/auth-registration.service';
import { ACCOUNT_REPOSITORY, RBAC_REPOSITORY } from '@auth/repositories';
import { AuthConfigService } from '@auth/config';
import { OUTBOX_REPOSITORY } from '@auth/outbox/repositories/outbox.repository.interface';
import { UNIT_OF_WORK } from '@auth/unit-of-work';
import {
   AUTH_RATE_LIMITER,
   AuditLogService,
   EmailBloomFilterService,
   PASSWORD_HASHER,
   TOKEN_LIFECYCLE_SERVICE,
   VERIFICATION_TOKEN_SERVICE,
} from '@auth/services/infrastructure';

describe('AuthRegistrationService', () => {
   let service: AuthRegistrationService;

   const mockAccountRepository = {
      findByEmail: jest.fn(),
      create: jest.fn(),
      update: jest.fn().mockResolvedValue(null),
      delete: jest.fn().mockResolvedValue(true),
      deleteAbortedByEmail: jest.fn().mockResolvedValue(0),
   };

   const mockRbacRepository = {
      findRoleByCode: jest.fn(),
   };

   const mockPasswordHasher = {
      hash: jest.fn().mockResolvedValue('$argon2id$hashed'),
      verify: jest.fn().mockResolvedValue(true),
   };

   const mockVerificationTokenService = {
      generate: jest.fn(),
      validate: jest.fn(),
      consume: jest.fn(),
   };

   const mockTokenLifecycleService = {
      generateTokenPair: jest.fn(),
      revokeAllAccountTokens: jest.fn().mockResolvedValue(undefined),
   };

   const mockEmailBloomFilterService = {
      isEmailAvailable: jest.fn().mockResolvedValue(true),
      mightContain: jest.fn().mockResolvedValue(false),
      addEmail: jest.fn().mockResolvedValue(undefined),
   };

   const mockOutboxRepository = {
      create: jest.fn(),
      deleteByAggregateId: jest.fn().mockResolvedValue(undefined),
   };

   const mockUnitOfWork = {
      runInTransaction: jest.fn().mockImplementation(async (work) => {
         return await work({
            accountRepository: mockAccountRepository,
            outboxRepository: mockOutboxRepository,
            rbacRepository: mockRbacRepository,
            sessionRepository: {} as never,
            auditLogRepository: {} as never,
         });
      }),
   };

   const mockRedisService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      ttl: jest.fn().mockResolvedValue(-2),
      incr: jest.fn().mockResolvedValue(1),
      expire: jest.fn(),
   };

   const mockAuditLogService = {
      record: jest.fn().mockResolvedValue(undefined),
   };

   const mockNotificationAdapter = {
      sendRegistrationOtp: jest.fn().mockResolvedValue(undefined),
   };

   const mockRateLimiter = {
      checkEmail: jest.fn().mockResolvedValue(undefined),
      checkSendRegisterOtp: jest.fn().mockResolvedValue(undefined),
      checkVerifyRegisterOtp: jest.fn().mockResolvedValue(undefined),
      checkOrThrow: jest.fn().mockResolvedValue(undefined),
      checkRateLimit: jest.fn(),
      reset: jest.fn(),
   };

   const mockConfig = {
      argon2Secret: 'test-secret',
   };

   beforeEach(async () => {
      jest.clearAllMocks();

      const module: TestingModule = await Test.createTestingModule({
         providers: [
            AuthRegistrationService,
            {
               provide: RbacCacheService,
               useValue: { getRole: jest.fn().mockResolvedValue({ id: 'r1', permissions: [] }), setRole: jest.fn() },
            },
            {
               provide: ACCOUNT_REPOSITORY,
               useValue: mockAccountRepository,
            },
            {
               provide: RBAC_REPOSITORY,
               useValue: mockRbacRepository,
            },
            {
               provide: VERIFICATION_TOKEN_SERVICE,
               useValue: mockVerificationTokenService,
            },
            {
               provide: TOKEN_LIFECYCLE_SERVICE,
               useValue: mockTokenLifecycleService,
            },
            {
               provide: PASSWORD_HASHER,
               useValue: mockPasswordHasher,
            },
            {
               provide: AUTH_RATE_LIMITER,
               useValue: mockRateLimiter,
            },
            {
               provide: EmailBloomFilterService,
               useValue: mockEmailBloomFilterService,
            },
            {
               provide: OUTBOX_REPOSITORY,
               useValue: mockOutboxRepository,
            },
            {
               provide: UNIT_OF_WORK,
               useValue: mockUnitOfWork,
            },
            {
               provide: RedisService,
               useValue: mockRedisService,
            },
            {
               provide: AuditLogService,
               useValue: mockAuditLogService,
            },
            {
               provide: NOTIFICATION_ADAPTER,
               useValue: mockNotificationAdapter,
            },
            {
               provide: AuthConfigService,
               useValue: mockConfig,
            },
            {
               provide: EventEmitter2,
               useValue: { emit: jest.fn() },
            },
         ],
      }).compile();

      service = module.get<AuthRegistrationService>(AuthRegistrationService);
   });

   it('should be defined', () => {
      expect(service).toBeDefined();
   });

   it('should check email availability', async () => {
      const result = await service.checkEmail('test@example.com');
      expect(result).toEqual({ available: true, email: 'test@example.com' });
   });

   it('should send register OTP', async () => {
      const result = await service.sendRegisterOtp({ email: 'test@example.com' });
      expect(result.success).toBe(true);
      expect(mockNotificationAdapter.sendRegistrationOtp).toHaveBeenCalledWith(
         'test@example.com',
         expect.any(String),
         expect.any(Number),
      );
   });

   describe('register with RegisterSaga', () => {
      const mockCreatedAccount = {
         accountId: 'new-account-id',
         email: 'newuser@example.com',
         roles: [SYSTEM_ROLES.USER],
         status: USER_STATUS.ACTIVE,
         isEmailVerified: true,
         lastLoginAt: null,
         createdAt: '2026-10-12T00:00:00.000Z',
         updatedAt: '2026-10-12T00:00:00.000Z',
      };

      beforeEach(() => {
         mockPasswordHasher.hash.mockResolvedValue('$argon2id$hashed');
         mockAccountRepository.create.mockResolvedValue(mockCreatedAccount);
         mockOutboxRepository.create.mockResolvedValue({
            eventId: 'mock-event-id',
            aggregateType: AUTH_AGGREGATES.ACCOUNT,
            aggregateId: 'new-account-id',
            eventType: NOTIFICATION_EVENTS.USER_REGISTERED,
            payload: { email: 'newuser@example.com' },
         });
         mockTokenLifecycleService.generateTokenPair.mockResolvedValue({
            accessToken: 'mock-reg-access',
            refreshToken: 'mock-reg-refresh',
         });
      });

      it('should successfully register, create account, generate tokens, add bloom, trigger publisher, and log audit', async () => {
         const result = await service.register({
            email: 'newuser@example.com',
            password: 'Password123!',
            confirmPassword: 'Password123!',
         });

         expect(result.user.userId).toBe('new-account-id');
         expect(result.accessToken).toBe('mock-reg-access');
         expect(result.refreshToken).toBe('mock-reg-refresh');

         expect(mockUnitOfWork.runInTransaction).toHaveBeenCalled();
         expect(mockAccountRepository.create).toHaveBeenCalled();
         expect(mockOutboxRepository.create).toHaveBeenCalled();
         expect(mockTokenLifecycleService.generateTokenPair).toHaveBeenCalledWith(
            expect.objectContaining({ accountId: 'new-account-id', email: 'newuser@example.com' }),
            undefined,
         );
         expect(mockEmailBloomFilterService.addEmail).toHaveBeenCalledWith('newuser@example.com');
         expect(mockAuditLogService.record).toHaveBeenCalled();
      });

      it('should successfully register with valid verification token matching email', async () => {
         mockVerificationTokenService.consume.mockResolvedValue('newuser@example.com');

         const result = await service.register({
            email: 'newuser@example.com',
            password: 'Password123!',
            confirmPassword: 'Password123!',
            verificationToken: 'vtok_018d45e07c2a7f61b54110c7936a28e8',
         });

         expect(result.user.userId).toBe('new-account-id');
         expect(mockVerificationTokenService.consume).toHaveBeenCalledWith('vtok_018d45e07c2a7f61b54110c7936a28e8');
      });

      it('should throw BadRequestException if email format is invalid', async () => {
         await expect(
            service.register({
               email: 'not-an-email',
               password: 'Password123!',
               confirmPassword: 'Password123!',
            }),
         ).rejects.toThrow(AUTH_ERROR_CODES.INVALID_EMAIL_FORMAT);
      });

      it('should throw BadRequestException if password fails domain strength rules', async () => {
         await expect(
            service.register({
               email: 'newuser@example.com',
               password: 'weak',
               confirmPassword: 'weak',
            }),
         ).rejects.toThrow(AUTH_ERROR_CODES.WEAK_PASSWORD);
      });

      it('should throw BadRequestException if verificationToken format is invalid', async () => {
         await expect(
            service.register({
               email: 'newuser@example.com',
               password: 'Password123!',
               confirmPassword: 'Password123!',
               verificationToken: 'invalid_prefix_token',
            }),
         ).rejects.toThrow(AUTH_ERROR_CODES.INVALID_VERIFICATION_TOKEN);
      });

      it('should throw UnauthorizedException if verificationToken is expired or not found', async () => {
         mockVerificationTokenService.consume.mockResolvedValue(null);

         await expect(
            service.register({
               email: 'newuser@example.com',
               password: 'Password123!',
               confirmPassword: 'Password123!',
               verificationToken: 'vtok_018d45e07c2a7f61b54110c7936a28e8',
            }),
         ).rejects.toThrow(UnauthorizedException);
      });

      it('should throw BadRequestException EMAIL_MISMATCH if verificationToken belongs to different email', async () => {
         mockVerificationTokenService.consume.mockResolvedValue('different@example.com');

         await expect(
            service.register({
               email: 'newuser@example.com',
               password: 'Password123!',
               confirmPassword: 'Password123!',
               verificationToken: 'vtok_018d45e07c2a7f61b54110c7936a28e8',
            }),
         ).rejects.toThrow(AUTH_ERROR_CODES.EMAIL_MISMATCH);
      });

      it('should compensate by deleting outbox events and marking account REGISTRATION_ABORTED if token generation fails', async () => {
         mockTokenLifecycleService.generateTokenPair.mockRejectedValue(new Error('Redis session write failed'));

         await expect(
            service.register({
               email: 'newuser@example.com',
               password: 'Password123!',
               confirmPassword: 'Password123!',
            }),
         ).rejects.toThrow('Redis session write failed');

         expect(mockOutboxRepository.deleteByAggregateId).toHaveBeenCalledWith('new-account-id');
         expect(mockAccountRepository.update).toHaveBeenCalledWith('new-account-id', {
            status: USER_STATUS.REGISTRATION_ABORTED,
         });
         expect(mockAccountRepository.delete).not.toHaveBeenCalled();
      });

      it('should self-heal and allow re-registration if existing account has REGISTRATION_ABORTED status', async () => {
         mockAccountRepository.findByEmail.mockResolvedValue({
            accountId: 'aborted-account-id',
            email: 'newuser@example.com',
            status: USER_STATUS.REGISTRATION_ABORTED,
         });

         const result = await service.register({
            email: 'newuser@example.com',
            password: 'Password123!',
            confirmPassword: 'Password123!',
         });

         expect(mockAccountRepository.deleteAbortedByEmail).toHaveBeenCalledWith('newuser@example.com');
         expect(result.user.userId).toBe('new-account-id');
      });

      it('should succeed even if audit log fails (non-blocking fire-and-forget)', async () => {
         mockAuditLogService.record.mockRejectedValue(new Error('Audit log failure'));

         const result = await service.register({
            email: 'newuser@example.com',
            password: 'Password123!',
            confirmPassword: 'Password123!',
         });

         expect(result.user.userId).toBe('new-account-id');
         expect(result.accessToken).toBe('mock-reg-access');
      });
   });
});
