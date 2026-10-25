import { Test, TestingModule } from '@nestjs/testing';
import { SYSTEM_ROLES, UnauthorizedException } from '@common';
import { USER_STATUS } from '@contracts/auth';
import { ACCOUNT_REPOSITORY } from '@auth/repositories';
import { AUTH_RATE_LIMITER, AuditLogService, TOKEN_LIFECYCLE_SERVICE } from '@auth/services/infrastructure';
import { AuthTokenService } from '@auth/services/domain/auth-token.service';

describe('AuthTokenService', () => {
   let service: AuthTokenService;

   const mockAccountRepository = {
      findById: jest.fn(),
   };

   const mockTokenLifecycleService = {
      rotateTokenPair: jest.fn(),
      validateAccessToken: jest.fn(),
      validateRefreshToken: jest.fn(),
      revokeToken: jest.fn(),
      revokeAllAccountTokens: jest.fn(),
      logoutAll: jest.fn(),
   };

   const mockRateLimiter = {
      checkRefreshToken: jest.fn().mockResolvedValue(undefined),
   };

   const mockAuditLogService = {
      record: jest.fn().mockResolvedValue(undefined),
   };

   beforeEach(async () => {
      jest.clearAllMocks();

      const module: TestingModule = await Test.createTestingModule({
         providers: [
            AuthTokenService,
            {
               provide: ACCOUNT_REPOSITORY,
               useValue: mockAccountRepository,
            },
            {
               provide: TOKEN_LIFECYCLE_SERVICE,
               useValue: mockTokenLifecycleService,
            },
            {
               provide: AUTH_RATE_LIMITER,
               useValue: mockRateLimiter,
            },
            {
               provide: AuditLogService,
               useValue: mockAuditLogService,
            },
         ],
      }).compile();

      service = module.get<AuthTokenService>(AuthTokenService);
   });

   it('should be defined', () => {
      expect(service).toBeDefined();
   });

   describe('refreshToken', () => {
      const mockPayload = {
         sub: 'acc-1',
         jti: 'jti-1',
         roles: [SYSTEM_ROLES.USER],
         exp: Math.floor(Date.now() / 1000) + 3600,
      };

      const mockAccount = {
         accountId: 'acc-1',
         email: 'test@example.com',
         roles: [SYSTEM_ROLES.USER],
         status: USER_STATUS.ACTIVE,
         isEmailVerified: true,
         lastLoginAt: '2026-10-10T00:00:00.000Z',
         createdAt: '2026-10-01T00:00:00.000Z',
         updatedAt: '2026-10-10T00:00:00.000Z',
      };

      it('should refresh token pair successfully and record audit log', async () => {
         mockTokenLifecycleService.validateRefreshToken.mockResolvedValueOnce(mockPayload);
         mockAccountRepository.findById.mockResolvedValueOnce(mockAccount);
         mockTokenLifecycleService.rotateTokenPair.mockResolvedValueOnce({
            accessToken: 'new-access-token',
            refreshToken: 'new-refresh-token',
         });

         const result = await service.refreshToken('valid-refresh-token', { ipAddress: '127.0.0.1' });

         expect(mockRateLimiter.checkRefreshToken).toHaveBeenCalledWith('acc-1');
         expect(mockTokenLifecycleService.rotateTokenPair).toHaveBeenCalled();
         expect(mockAuditLogService.record).toHaveBeenCalled();
         expect(result.accessToken).toBe('new-access-token');
         expect(result.refreshToken).toBe('new-refresh-token');
         expect(result.user.userId).toBe('acc-1');
      });

      it('should throw UnauthorizedException if account is blocked and trigger logoutAll', async () => {
         mockTokenLifecycleService.validateRefreshToken.mockResolvedValueOnce(mockPayload);
         mockAccountRepository.findById.mockResolvedValueOnce({
            ...mockAccount,
            status: USER_STATUS.BLOCKED,
         });

         await expect(service.refreshToken('valid-refresh-token')).rejects.toThrow(UnauthorizedException);
         expect(mockTokenLifecycleService.logoutAll).toHaveBeenCalledWith('acc-1');
      });

      it('should throw UnauthorizedException if account is inactive and trigger logoutAll', async () => {
         mockTokenLifecycleService.validateRefreshToken.mockResolvedValueOnce(mockPayload);
         mockAccountRepository.findById.mockResolvedValueOnce({
            ...mockAccount,
            status: USER_STATUS.INACTIVE,
         });

         await expect(service.refreshToken('valid-refresh-token')).rejects.toThrow(UnauthorizedException);
         expect(mockTokenLifecycleService.logoutAll).toHaveBeenCalledWith('acc-1');
      });

      it('should throw UnauthorizedException if user not found', async () => {
         mockTokenLifecycleService.validateRefreshToken.mockResolvedValueOnce(mockPayload);
         mockAccountRepository.findById.mockResolvedValueOnce(null);

         await expect(service.refreshToken('valid-refresh-token')).rejects.toThrow(UnauthorizedException);
      });
   });

   describe('revokeToken', () => {
      it('should revoke token and record audit log', async () => {
         await service.revokeToken('token-to-revoke', { ipAddress: '127.0.0.1' });

         expect(mockTokenLifecycleService.revokeToken).toHaveBeenCalledWith('token-to-revoke');
         expect(mockAuditLogService.record).toHaveBeenCalled();
      });

      it('should rethrow error when revoking token fails', async () => {
         mockTokenLifecycleService.revokeToken.mockRejectedValueOnce(new Error('Revoke error'));

         await expect(service.revokeToken('bad-token')).rejects.toThrow('Revoke error');
      });
   });

   describe('revokeAllAccountTokens', () => {
      it('should revoke all tokens for an account and record audit log', async () => {
         await service.revokeAllAccountTokens('acc-1', { ipAddress: '127.0.0.1' });

         expect(mockTokenLifecycleService.revokeAllAccountTokens).toHaveBeenCalledWith('acc-1');
         expect(mockAuditLogService.record).toHaveBeenCalled();
      });
   });

   describe('logoutAll', () => {
      it('should logout all sessions and record audit log', async () => {
         await service.logoutAll('acc-1');

         expect(mockTokenLifecycleService.logoutAll).toHaveBeenCalledWith('acc-1');
         expect(mockAuditLogService.record).toHaveBeenCalled();
      });
   });

   describe('validateToken', () => {
      it('should validate token and return account info when active', async () => {
         mockTokenLifecycleService.validateAccessToken.mockResolvedValueOnce({
            sub: 'acc-1',
            roles: [SYSTEM_ROLES.USER],
         });
         mockAccountRepository.findById.mockResolvedValueOnce({
            accountId: 'acc-1',
            email: 'user@example.com',
            roles: [SYSTEM_ROLES.USER],
            status: USER_STATUS.ACTIVE,
            isEmailVerified: true,
            lastLoginAt: '2026-10-10T00:00:00.000Z',
            createdAt: '2026-10-01T00:00:00.000Z',
            updatedAt: '2026-10-10T00:00:00.000Z',
         });

         const result = await service.validateToken('valid-access-token');

         expect(result.valid).toBe(true);
         expect(result.user.userId).toBe('acc-1');
      });

      it('should throw UnauthorizedException if account not found', async () => {
         mockTokenLifecycleService.validateAccessToken.mockResolvedValueOnce({ sub: 'acc-nonexistent' });
         mockAccountRepository.findById.mockResolvedValueOnce(null);

         await expect(service.validateToken('token')).rejects.toThrow(UnauthorizedException);
      });

      it('should throw UnauthorizedException if account is blocked', async () => {
         mockTokenLifecycleService.validateAccessToken.mockResolvedValueOnce({ sub: 'acc-blocked' });
         mockAccountRepository.findById.mockResolvedValueOnce({
            accountId: 'acc-blocked',
            status: USER_STATUS.BLOCKED,
         });

         await expect(service.validateToken('token')).rejects.toThrow(UnauthorizedException);
      });

      it('should throw UnauthorizedException if account is inactive', async () => {
         mockTokenLifecycleService.validateAccessToken.mockResolvedValueOnce({ sub: 'acc-inactive' });
         mockAccountRepository.findById.mockResolvedValueOnce({
            accountId: 'acc-inactive',
            status: USER_STATUS.INACTIVE,
         });

         await expect(service.validateToken('token')).rejects.toThrow(UnauthorizedException);
      });
   });
});
