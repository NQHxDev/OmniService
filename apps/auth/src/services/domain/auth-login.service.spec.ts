import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RedisService, SYSTEM_ROLES, UnauthorizedException } from '@common';
import { USER_STATUS } from '@contracts/auth';
import { AUTH_LOCKOUT_VALUE } from '@auth/constants';
import { AUTH_DOMAIN_EVENTS } from '@auth/domain/events';
import { AuthLoginService } from '@auth/services/domain/auth-login.service';
import { AuthRbacService } from '@auth/services/domain/auth-rbac.service';
import { ACCOUNT_REPOSITORY } from '@auth/repositories';
import {
   AUTH_RATE_LIMITER,
   AuditLogService,
   PASSWORD_HASHER,
   TOKEN_LIFECYCLE_SERVICE,
} from '@auth/services/infrastructure';

describe('AuthLoginService', () => {
   let service: AuthLoginService;

   const mockAccountRepository = {
      findByEmail: jest.fn(),
      update: jest.fn(),
   };

   const mockAuthRbacService = {
      getOrCacheRole: jest.fn().mockResolvedValue({ id: 'r1', code: SYSTEM_ROLES.USER, permissions: [] }),
   };

   const mockPasswordHasher = {
      verify: jest.fn().mockResolvedValue(true),
   };

   const mockTokenLifecycleService = {
      generateTokenPair: jest.fn(),
      revokeAllAccountTokens: jest.fn(),
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

   const mockRateLimiter = {
      checkLogin: jest.fn().mockResolvedValue(undefined),
   };

   const mockEventEmitter = {
      emit: jest.fn(),
   };

   beforeEach(async () => {
      jest.clearAllMocks();

      const module: TestingModule = await Test.createTestingModule({
         providers: [
            AuthLoginService,
            {
               provide: ACCOUNT_REPOSITORY,
               useValue: mockAccountRepository,
            },
            {
               provide: AuthRbacService,
               useValue: mockAuthRbacService,
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
               provide: RedisService,
               useValue: mockRedisService,
            },
            {
               provide: AuditLogService,
               useValue: mockAuditLogService,
            },
            {
               provide: EventEmitter2,
               useValue: mockEventEmitter,
            },
         ],
      }).compile();

      service = module.get<AuthLoginService>(AuthLoginService);
   });

   it('should be defined', () => {
      expect(service).toBeDefined();
   });

   describe('login with LoginSaga', () => {
      const mockAccount = {
         accountId: 'user-id-1',
         email: 'test@example.com',
         passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$dummyhash',
         roles: [SYSTEM_ROLES.USER],
         status: USER_STATUS.ACTIVE,
         isEmailVerified: true,
         lastLoginAt: '2026-10-12T00:00:00.000Z',
         createdAt: '2026-10-10T00:00:00.000Z',
         updatedAt: '2026-10-12T00:00:00.000Z',
      };

      beforeEach(() => {
         mockPasswordHasher.verify.mockResolvedValue(true);
         mockAccountRepository.findByEmail.mockResolvedValue(mockAccount);
         mockTokenLifecycleService.generateTokenPair.mockResolvedValue({
            accessToken: 'mock-access-token',
            refreshToken: 'mock-refresh-token',
         });
         mockAccountRepository.update.mockResolvedValue(mockAccount);
      });

      it('should successfully login, generate tokens first, update db, clear redis, and record audit log', async () => {
         const result = await service.login({ email: 'test@example.com', password: 'password123' });

         expect(result.user.userId).toBe('user-id-1');
         expect(result.accessToken).toBe('mock-access-token');
         expect(result.refreshToken).toBe('mock-refresh-token');

         // Token pair generated first
         expect(mockTokenLifecycleService.generateTokenPair).toHaveBeenCalledWith(
            expect.objectContaining({ accountId: 'user-id-1', email: 'test@example.com' }),
            undefined,
         );
         // Database updated with new lastLoginAt
         expect(mockAccountRepository.update).toHaveBeenCalledWith(
            'user-id-1',
            expect.objectContaining({ lastLoginAt: expect.any(String) as unknown }) as unknown,
         );
         // Redis attempt keys cleared
         expect(mockRedisService.del).toHaveBeenCalled();
         // Audit log recorded
         expect(mockAuditLogService.record).toHaveBeenCalled();
      });

      it('should rollback and revoke tokens if database update fails', async () => {
         mockAccountRepository.update.mockRejectedValue(new Error('Database write failure'));

         await expect(service.login({ email: 'test@example.com', password: 'password123' })).rejects.toThrow(
            'Database write failure',
         );

         expect(mockTokenLifecycleService.revokeAllAccountTokens).toHaveBeenCalledWith('user-id-1');
      });

      it('should succeed even if audit log fails (non-blocking fire-and-forget)', async () => {
         mockAuditLogService.record.mockRejectedValueOnce(new Error('Audit log DB failure'));

         const result = await service.login({ email: 'test@example.com', password: 'password123' });

         expect(result.user.userId).toBe('user-id-1');
         expect(result.accessToken).toBe('mock-access-token');
      });

      it('should call rateLimiter.checkLogin on login and throw if rate limited', async () => {
         mockRateLimiter.checkLogin.mockRejectedValueOnce(new Error('Rate limit exceeded'));

         await expect(service.login({ email: 'test@example.com', password: 'password123' })).rejects.toThrow(
            'Rate limit exceeded',
         );
         expect(mockRateLimiter.checkLogin).toHaveBeenCalledWith('test@example.com', 'unknown');
      });

      it('should throw UnauthorizedException if account is blocked', async () => {
         mockAccountRepository.findByEmail.mockResolvedValueOnce({
            ...mockAccount,
            status: USER_STATUS.BLOCKED,
         });

         await expect(service.login({ email: 'test@example.com', password: 'password123' })).rejects.toThrow(
            UnauthorizedException,
         );
      });

      it('should throw UnauthorizedException if account is inactive', async () => {
         mockAccountRepository.findByEmail.mockResolvedValueOnce({
            ...mockAccount,
            status: USER_STATUS.INACTIVE,
         });

         await expect(service.login({ email: 'test@example.com', password: 'password123' })).rejects.toThrow(
            UnauthorizedException,
         );
      });

      it('should emit domain events on success and failure', async () => {
         const result = await service.login({ email: 'test@example.com', password: 'password123' });
         expect(result.accessToken).toBe('mock-access-token');
         expect(mockEventEmitter.emit).toHaveBeenCalledWith(AUTH_DOMAIN_EVENTS.LOGIN_SUCCESS, expect.any(Object));

         mockAccountRepository.findByEmail.mockResolvedValueOnce(null);
         await expect(service.login({ email: 'unknown@example.com', password: 'password123' })).rejects.toThrow();
         expect(mockEventEmitter.emit).toHaveBeenCalledWith(AUTH_DOMAIN_EVENTS.LOGIN_FAILED, expect.any(Object));
      });

      it('should reject login if account is locked in Redis', async () => {
         mockRedisService.get.mockResolvedValueOnce(AUTH_LOCKOUT_VALUE);
         mockRedisService.ttl.mockResolvedValueOnce(300);

         await expect(service.login({ email: 'test@example.com', password: 'password123' })).rejects.toThrow(
            UnauthorizedException,
         );
         expect(mockEventEmitter.emit).toHaveBeenCalled();
      });

      it('should lock account after max failed attempts on wrong password', async () => {
         mockPasswordHasher.verify.mockResolvedValueOnce(false);
         mockRedisService.incr.mockResolvedValueOnce(5);

         await expect(service.login({ email: 'test@example.com', password: 'wrong' })).rejects.toThrow(
            UnauthorizedException,
         );
         expect(mockRedisService.set).toHaveBeenCalled();
      });
   });
});
