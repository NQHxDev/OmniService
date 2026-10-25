import { DEFAULT_ROLES } from '@common';
import { USER_STATUS } from '@contracts/auth';
import type { AccountEntity } from '@auth/entities';
import type { ITokenLifecycleService } from '@auth/services/infrastructure';
import { RegisterSaga } from '@auth/sagas/register.saga';

describe('RegisterSaga', () => {
   let saga: RegisterSaga;
   let mockAccountRepository: {
      findByEmail: jest.Mock;
      findById: jest.Mock;
      findAllEmails: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      softDelete: jest.Mock;
      delete: jest.Mock;
   };
   let mockTokenLifecycleService: {
      generateTokenPair: jest.Mock;
      rotateTokenPair: jest.Mock;
      validateAccessToken: jest.Mock;
      validateRefreshToken: jest.Mock;
      revokeToken: jest.Mock;
      revokeAllAccountTokens: jest.Mock;
      logoutAll: jest.Mock;
   };
   let mockOutboxRepository: {
      create: jest.Mock;
      findPending: jest.Mock;
      markAsProcessing: jest.Mock;
      markAsPublished: jest.Mock;
      markAsFailed: jest.Mock;
      deleteByAggregateId: jest.Mock;
   };

   const mockAccount: AccountEntity = {
      accountId: 'acc-new',
      email: 'newuser@example.com',
      passwordHash: 'hash',
      roles: [DEFAULT_ROLES.USER],
      status: USER_STATUS.ACTIVE,
      isEmailVerified: false,
      lastLoginAt: null,
      version: 1,
      deletedAt: null,
      createdAt: '2026-10-12T00:00:00.000Z',
      updatedAt: '2026-10-12T00:00:00.000Z',
   };

   beforeEach(() => {
      mockAccountRepository = {
         findByEmail: jest.fn(),
         findById: jest.fn(),
         findAllEmails: jest.fn(),
         create: jest.fn(),
         update: jest.fn(),
         softDelete: jest.fn().mockResolvedValue(true),
         delete: jest.fn().mockResolvedValue(true),
      };

      mockTokenLifecycleService = {
         generateTokenPair: jest.fn(),
         rotateTokenPair: jest.fn(),
         validateAccessToken: jest.fn(),
         validateRefreshToken: jest.fn(),
         revokeToken: jest.fn(),
         revokeAllAccountTokens: jest.fn().mockResolvedValue(undefined),
         logoutAll: jest.fn(),
      };

      mockOutboxRepository = {
         create: jest.fn(),
         findPending: jest.fn(),
         markAsProcessing: jest.fn(),
         markAsPublished: jest.fn(),
         markAsFailed: jest.fn(),
         deleteByAggregateId: jest.fn().mockResolvedValue(undefined),
      };

      saga = new RegisterSaga(
         mockAccountRepository,
         mockTokenLifecycleService as unknown as ITokenLifecycleService,
         mockOutboxRepository,
      );
   });

   it('should do nothing on rollback if account was not set', async () => {
      await saga.rollback();
      expect(mockTokenLifecycleService.revokeAllAccountTokens).not.toHaveBeenCalled();
      expect(mockOutboxRepository.deleteByAggregateId).not.toHaveBeenCalled();
      expect(mockAccountRepository.delete).not.toHaveBeenCalled();
   });

   it('should delete outbox event and delete account on rollback', async () => {
      saga.setAccount(mockAccount);

      await saga.rollback();

      expect(mockTokenLifecycleService.revokeAllAccountTokens).not.toHaveBeenCalled();
      expect(mockOutboxRepository.deleteByAggregateId).toHaveBeenCalledWith('acc-new');
      expect(mockAccountRepository.delete).toHaveBeenCalledWith('acc-new');
   });

   it('should revoke tokens, delete outbox, and delete account if tokens were set', async () => {
      saga.setAccount(mockAccount);
      saga.setTokens({ accessToken: 'at', refreshToken: 'rt' });

      await saga.rollback();

      expect(mockTokenLifecycleService.revokeAllAccountTokens).toHaveBeenCalledWith('acc-new');
      expect(mockOutboxRepository.deleteByAggregateId).toHaveBeenCalledWith('acc-new');
      expect(mockAccountRepository.delete).toHaveBeenCalledWith('acc-new');
   });

   it('should handle errors gracefully during rollback without rethrowing', async () => {
      saga.setAccount(mockAccount);
      saga.setTokens({ accessToken: 'at', refreshToken: 'rt' });

      mockTokenLifecycleService.revokeAllAccountTokens.mockRejectedValue(new Error('Redis failure'));
      mockOutboxRepository.deleteByAggregateId.mockRejectedValue(new Error('Outbox delete failure'));
      mockAccountRepository.delete.mockRejectedValue(new Error('DB failure'));

      await expect(saga.rollback()).resolves.toBeUndefined();
   });
});
