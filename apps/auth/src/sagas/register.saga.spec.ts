import { DEFAULT_ROLES } from '@common';
import { USER_STATUS } from '@contracts/auth';
import { SAGA_STATUS, SAGA_STEP_STATUS, SAGA_TYPES, type ISagaRepository } from '@common/saga';
import { REGISTER_SAGA_STEPS } from '@auth/constants';
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
      deleteAbortedByEmail: jest.Mock;
      findExpiredPending: jest.Mock;
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
   let mockSagaRepository: jest.Mocked<ISagaRepository>;

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
         update: jest.fn().mockResolvedValue(null),
         softDelete: jest.fn().mockResolvedValue(true),
         delete: jest.fn().mockResolvedValue(true),
         deleteAbortedByEmail: jest.fn().mockResolvedValue(0),
         findExpiredPending: jest.fn().mockResolvedValue([]),
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

      mockSagaRepository = {
         createInstance: jest.fn().mockResolvedValue({
            sagaId: 'saga-123',
            sagaType: SAGA_TYPES.USER_REGISTRATION,
            aggregateId: 'acc-new',
            currentState: SAGA_STATUS.STARTED,
            payload: {},
            retryCount: 0,
            maxRetries: 3,
            timeoutAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
         }),
         findInstanceById: jest.fn(),
         findInstanceByAggregateId: jest.fn(),
         updateInstanceStatus: jest.fn().mockResolvedValue(undefined),
         recordStepLog: jest.fn().mockResolvedValue(undefined),
         findStuckSagas: jest.fn().mockResolvedValue([]),
      };

      saga = new RegisterSaga(
         mockAccountRepository,
         mockTokenLifecycleService as unknown as ITokenLifecycleService,
         mockOutboxRepository,
         mockSagaRepository,
      );
   });

   it('should do nothing on rollback if account was not set', async () => {
      await saga.rollback();
      expect(mockTokenLifecycleService.revokeAllAccountTokens).not.toHaveBeenCalled();
      expect(mockOutboxRepository.deleteByAggregateId).not.toHaveBeenCalled();
      expect(mockAccountRepository.update).not.toHaveBeenCalled();
   });

   it('should persist saga instance and step log when setAccount is called', async () => {
      await saga.setAccount(mockAccount);

      expect(mockSagaRepository.createInstance).toHaveBeenCalledWith(
         expect.objectContaining({
            sagaType: SAGA_TYPES.USER_REGISTRATION,
            aggregateId: 'acc-new',
         }),
      );
      expect(mockSagaRepository.recordStepLog).toHaveBeenCalledWith(
         expect.objectContaining({
            stepName: REGISTER_SAGA_STEPS.ACCOUNT_PROVISIONED,
            status: SAGA_STEP_STATUS.SUCCEEDED,
         }),
      );
   });

   it('should record tokens_generated step log when setTokens is called', async () => {
      await saga.setAccount(mockAccount);
      await saga.setTokens({ accessToken: 'at', refreshToken: 'rt' });

      expect(mockSagaRepository.recordStepLog).toHaveBeenCalledWith(
         expect.objectContaining({
            stepName: REGISTER_SAGA_STEPS.TOKENS_GENERATED,
            status: SAGA_STEP_STATUS.SUCCEEDED,
         }),
      );
      expect(mockSagaRepository.updateInstanceStatus).toHaveBeenCalledWith(
         expect.any(String),
         SAGA_STATUS.EXECUTING,
         expect.objectContaining({ step: REGISTER_SAGA_STEPS.TOKENS_GENERATED }),
      );
   });

   it('should mark saga as COMPLETED when complete is called', async () => {
      await saga.setAccount(mockAccount);
      await saga.complete();

      expect(mockSagaRepository.updateInstanceStatus).toHaveBeenCalledWith(
         expect.any(String),
         SAGA_STATUS.COMPLETED,
         expect.objectContaining({ step: null }),
      );
   });

   it('should delete outbox event and mark account REGISTRATION_ABORTED on rollback (zero hard delete)', async () => {
      await saga.setAccount(mockAccount);

      await saga.rollback();

      expect(mockTokenLifecycleService.revokeAllAccountTokens).not.toHaveBeenCalled();
      expect(mockOutboxRepository.deleteByAggregateId).toHaveBeenCalledWith('acc-new');
      expect(mockAccountRepository.update).toHaveBeenCalledWith('acc-new', {
         status: USER_STATUS.REGISTRATION_ABORTED,
      });
      expect(mockAccountRepository.delete).not.toHaveBeenCalled();
      expect(mockSagaRepository.updateInstanceStatus).toHaveBeenCalledWith(
         expect.any(String),
         SAGA_STATUS.COMPENSATED,
         expect.any(Object),
      );
   });

   it('should revoke tokens, delete outbox, and mark REGISTRATION_ABORTED if tokens were set', async () => {
      await saga.setAccount(mockAccount);
      await saga.setTokens({ accessToken: 'at', refreshToken: 'rt' });

      await saga.rollback();

      expect(mockTokenLifecycleService.revokeAllAccountTokens).toHaveBeenCalledWith('acc-new');
      expect(mockOutboxRepository.deleteByAggregateId).toHaveBeenCalledWith('acc-new');
      expect(mockAccountRepository.update).toHaveBeenCalledWith('acc-new', {
         status: USER_STATUS.REGISTRATION_ABORTED,
      });
   });

   it('should handle errors gracefully during rollback without rethrowing', async () => {
      await saga.setAccount(mockAccount);
      await saga.setTokens({ accessToken: 'at', refreshToken: 'rt' });

      mockTokenLifecycleService.revokeAllAccountTokens.mockRejectedValue(new Error('Redis failure'));
      mockOutboxRepository.deleteByAggregateId.mockRejectedValue(new Error('Outbox delete failure'));
      mockAccountRepository.update.mockRejectedValue(new Error('DB failure'));

      await expect(saga.rollback()).resolves.toBeUndefined();
   });
});
