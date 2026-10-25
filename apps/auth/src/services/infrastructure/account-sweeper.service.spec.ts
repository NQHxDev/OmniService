import { USER_STATUS } from '@contracts/auth';
import type { IAccountRepository } from '@auth/repositories';
import type { AccountEntity } from '@auth/entities';
import { AccountSweeperService } from '@auth/services/infrastructure/account-sweeper.service';

describe('AccountSweeperService', () => {
   let service: AccountSweeperService;
   let mockAccountRepo: jest.Mocked<IAccountRepository>;

   const createMockAccount = (id: string, status: string, createdAt: string): AccountEntity => ({
      accountId: id,
      email: `${id}@example.com`,
      passwordHash: 'hash',
      status,
      isEmailVerified: false,
      createdAt,
   });

   beforeEach(() => {
      mockAccountRepo = {
         findByEmail: jest.fn(),
         findById: jest.fn(),
         findAllEmails: jest.fn(),
         create: jest.fn(),
         update: jest.fn().mockResolvedValue(null),
         softDelete: jest.fn(),
         delete: jest.fn(),
         deleteAbortedByEmail: jest.fn(),
         findExpiredPending: jest.fn(),
      };

      service = new AccountSweeperService(mockAccountRepo, {
         sweepIntervalMs: 60000,
         expirationThresholdMs: 86400000, // 24h
         batchSize: 10,
      });
   });

   afterEach(() => {
      service.stopSweeper();
   });

   it('should find expired pending accounts and update them to REGISTRATION_ABORTED', async () => {
      const expiredDate = new Date(Date.now() - 90000000).toISOString();
      const accounts = [
         createMockAccount('acc-1', USER_STATUS.PENDING_ACTIVATION, expiredDate),
         createMockAccount('acc-2', USER_STATUS.PENDING_ACTIVATION, expiredDate),
      ];
      mockAccountRepo.findExpiredPending.mockResolvedValue(accounts);

      const swept = await service.sweepExpiredAccounts();

      expect(swept).toBe(2);
      expect(mockAccountRepo.findExpiredPending).toHaveBeenCalled();
      expect(mockAccountRepo.update).toHaveBeenCalledWith('acc-1', {
         status: USER_STATUS.REGISTRATION_ABORTED,
      });
      expect(mockAccountRepo.update).toHaveBeenCalledWith('acc-2', {
         status: USER_STATUS.REGISTRATION_ABORTED,
      });
   });

   it('should return 0 when no accounts are expired', async () => {
      mockAccountRepo.findExpiredPending.mockResolvedValue([]);

      const swept = await service.sweepExpiredAccounts();

      expect(swept).toBe(0);
      expect(mockAccountRepo.update).not.toHaveBeenCalled();
   });

   it('should continue sweeping even if one account update throws', async () => {
      const expiredDate = new Date(Date.now() - 90000000).toISOString();
      const accounts = [
         createMockAccount('acc-fail', USER_STATUS.PENDING_ACTIVATION, expiredDate),
         createMockAccount('acc-ok', USER_STATUS.PENDING_ACTIVATION, expiredDate),
      ];
      mockAccountRepo.findExpiredPending.mockResolvedValue(accounts);
      mockAccountRepo.update.mockRejectedValueOnce(new Error('DB lock')).mockResolvedValueOnce(null);

      const swept = await service.sweepExpiredAccounts();

      expect(swept).toBe(1);
      expect(mockAccountRepo.update).toHaveBeenCalledTimes(2);
   });
});
