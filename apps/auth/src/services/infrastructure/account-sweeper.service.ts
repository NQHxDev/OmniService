import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { USER_STATUS } from '@contracts/auth';
import { ACCOUNT_REPOSITORY, type IAccountRepository } from '@auth/repositories';

export interface AccountSweeperOptions {
   sweepIntervalMs?: number;
   expirationThresholdMs?: number;
   batchSize?: number;
}

@Injectable()
export class AccountSweeperService implements OnModuleInit, OnModuleDestroy {
   private readonly logger = new Logger(AccountSweeperService.name);
   private sweepTimer: NodeJS.Timeout | null = null;
   private isSweeping = false;
   private readonly sweepIntervalMs: number;
   private readonly expirationThresholdMs: number;
   private readonly batchSize: number;

   constructor(
      @Inject(ACCOUNT_REPOSITORY)
      private readonly accountRepository: IAccountRepository,
      @Optional()
      options?: AccountSweeperOptions,
   ) {
      // Default: check every hour, sweep accounts pending activation > 24 hours
      this.sweepIntervalMs = options?.sweepIntervalMs ?? 3600000;
      this.expirationThresholdMs = options?.expirationThresholdMs ?? 24 * 60 * 60 * 1000;
      this.batchSize = options?.batchSize ?? 50;
   }

   onModuleInit(): void {
      this.startSweeper();
   }

   onModuleDestroy(): void {
      this.stopSweeper();
   }

   startSweeper(): void {
      if (this.sweepTimer) return;
      this.logger.log(`Starting AccountSweeperService (interval: ${this.sweepIntervalMs}ms)`);
      this.sweepTimer = setInterval(() => {
         void this.sweepExpiredAccounts();
      }, this.sweepIntervalMs);
   }

   stopSweeper(): void {
      if (this.sweepTimer) {
         clearInterval(this.sweepTimer);
         this.sweepTimer = null;
         this.logger.log('AccountSweeperService stopped');
      }
   }

   async triggerSweep(): Promise<number> {
      return this.sweepExpiredAccounts();
   }

   async sweepExpiredAccounts(): Promise<number> {
      if (this.isSweeping) {
         return 0;
      }
      this.isSweeping = true;

      try {
         const threshold = new Date(Date.now() - this.expirationThresholdMs);
         const expiredAccounts = await this.accountRepository.findExpiredPending(threshold, this.batchSize);

         if (expiredAccounts.length === 0) {
            return 0;
         }

         this.logger.log(`Found ${expiredAccounts.length} expired pending account(s) to sweep`);

         let sweptCount = 0;
         for (const account of expiredAccounts) {
            try {
               await this.accountRepository.update(account.accountId, {
                  status: USER_STATUS.REGISTRATION_ABORTED,
               });
               sweptCount++;
            } catch (err: unknown) {
               this.logger.error(
                  `Failed to sweep expired account ${account.accountId}: ${err instanceof Error ? err.message : String(err)}`,
               );
            }
         }

         this.logger.log(`Successfully swept ${sweptCount} expired pending account(s)`);
         return sweptCount;
      } catch (error: unknown) {
         this.logger.error('Error during AccountSweeper execution', error instanceof Error ? error.stack : undefined);
         return 0;
      } finally {
         this.isSweeping = false;
      }
   }
}
