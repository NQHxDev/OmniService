import { DEFAULT_ROLES } from '@common';
import { USER_STATUS } from '@contracts/auth';
import type { AccountEntity } from '@auth/entities';
import type { ITokenLifecycleService } from '@auth/services/infrastructure';
import { LoginSaga } from '@auth/sagas/login.saga';

describe('LoginSaga', () => {
   let saga: LoginSaga;
   let mockTokenLifecycleService: {
      generateTokenPair: jest.Mock;
      rotateTokenPair: jest.Mock;
      validateAccessToken: jest.Mock;
      validateRefreshToken: jest.Mock;
      revokeToken: jest.Mock;
      revokeAllAccountTokens: jest.Mock;
      logoutAll: jest.Mock;
   };
   let mockAccountRepository: {
      findByEmail: jest.Mock;
      findById: jest.Mock;
      findAllEmails: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      softDelete: jest.Mock;
      delete: jest.Mock;
   };

   const mockAccount: AccountEntity = {
      accountId: 'acc-1',
      email: 'test@example.com',
      passwordHash: 'hash',
      roles: [DEFAULT_ROLES.USER],
      status: USER_STATUS.ACTIVE,
      isEmailVerified: true,
      lastLoginAt: '2026-10-12T10:00:00.000Z',
      version: 1,
      deletedAt: null,
      createdAt: '2026-10-12T00:00:00.000Z',
      updatedAt: '2026-10-12T10:00:00.000Z',
   };

   beforeEach(() => {
      mockTokenLifecycleService = {
         generateTokenPair: jest.fn(),
         rotateTokenPair: jest.fn(),
         validateAccessToken: jest.fn(),
         validateRefreshToken: jest.fn(),
         revokeToken: jest.fn(),
         revokeAllAccountTokens: jest.fn().mockResolvedValue(undefined),
         logoutAll: jest.fn(),
      };

      mockAccountRepository = {
         findByEmail: jest.fn(),
         findById: jest.fn(),
         findAllEmails: jest.fn(),
         create: jest.fn(),
         update: jest.fn().mockResolvedValue(mockAccount),
         softDelete: jest.fn(),
         delete: jest.fn(),
      };

      saga = new LoginSaga(mockTokenLifecycleService as unknown as ITokenLifecycleService, mockAccountRepository);
   });

   it('should do nothing on rollback if account was not set', async () => {
      await saga.rollback();
      expect(mockTokenLifecycleService.revokeAllAccountTokens).not.toHaveBeenCalled();
      expect(mockAccountRepository.update).not.toHaveBeenCalled();
   });

   it('should revoke tokens on rollback if tokens were set', async () => {
      saga.setAccount(mockAccount);
      saga.setTokens({ accessToken: 'at', refreshToken: 'rt' });

      await saga.rollback();

      expect(mockTokenLifecycleService.revokeAllAccountTokens).toHaveBeenCalledWith('acc-1');
      expect(mockAccountRepository.update).not.toHaveBeenCalled();
   });

   it('should revert lastLoginAt if db was marked updated', async () => {
      saga.setAccount(mockAccount);
      saga.setTokens({ accessToken: 'at', refreshToken: 'rt' });
      saga.markDatabaseUpdated();

      await saga.rollback();

      expect(mockTokenLifecycleService.revokeAllAccountTokens).toHaveBeenCalledWith('acc-1');
      expect(mockAccountRepository.update).toHaveBeenCalledWith('acc-1', {
         lastLoginAt: '2026-10-12T10:00:00.000Z',
      });
   });

   it('should handle errors gracefully during rollback without rethrowing', async () => {
      saga.setAccount(mockAccount);
      saga.setTokens({ accessToken: 'at', refreshToken: 'rt' });
      saga.markDatabaseUpdated();

      mockTokenLifecycleService.revokeAllAccountTokens.mockRejectedValue(new Error('Redis connection down'));
      mockAccountRepository.update.mockRejectedValue(new Error('DB connection down'));

      await expect(saga.rollback()).resolves.toBeUndefined();
   });
});
