import { Logger } from '@nestjs/common';
import { uuidv7 } from '@common';
import { USER_STATUS } from '@contracts/auth';
import { SAGA_STATUS, SAGA_STEP_STATUS, SAGA_TYPES, type ISagaRepository } from '@common/saga';
import { REGISTER_SAGA_STEPS } from '@auth/constants';
import type { AccountEntity } from '@auth/entities';
import type { IAccountRepository } from '@auth/repositories';
import type { IOutboxRepository } from '@auth/outbox/repositories/outbox.repository.interface';
import type { ITokenLifecycleService, TokenPair } from '@auth/services/infrastructure';
import type { IAuthSaga } from '@auth/templates';

export class RegisterSaga implements IAuthSaga {
   private account?: AccountEntity;
   private tokens?: TokenPair;
   private sagaId?: string;
   private readonly logger = new Logger(RegisterSaga.name);

   constructor(
      private readonly accountRepository: IAccountRepository,
      private readonly tokenLifecycleService: ITokenLifecycleService,
      private readonly outboxRepository?: IOutboxRepository,
      private readonly sagaRepository?: ISagaRepository,
   ) {}

   async setAccount(account: AccountEntity): Promise<void> {
      this.account = account;

      if (this.sagaRepository) {
         try {
            this.sagaId = uuidv7();
            await this.sagaRepository.createInstance({
               sagaId: this.sagaId,
               sagaType: SAGA_TYPES.USER_REGISTRATION,
               aggregateId: account.accountId,
               initialPayload: {
                  accountId: account.accountId,
                  email: account.email,
                  status: account.status,
               },
               timeoutMs: 30000,
            });

            await this.sagaRepository.recordStepLog({
               sagaId: this.sagaId,
               stepName: REGISTER_SAGA_STEPS.ACCOUNT_PROVISIONED,
               status: SAGA_STEP_STATUS.SUCCEEDED,
               payload: {
                  accountId: account.accountId,
                  email: account.email,
                  status: account.status,
               },
            });
         } catch (error: unknown) {
            this.logger.error('Failed to persist saga registration checkpoint', error);
         }
      }
   }

   async setTokens(tokens: TokenPair): Promise<void> {
      this.tokens = tokens;

      if (this.sagaRepository && this.sagaId) {
         try {
            await this.sagaRepository.recordStepLog({
               sagaId: this.sagaId,
               stepName: REGISTER_SAGA_STEPS.TOKENS_GENERATED,
               status: SAGA_STEP_STATUS.SUCCEEDED,
            });

            await this.sagaRepository.updateInstanceStatus(this.sagaId, SAGA_STATUS.EXECUTING, {
               step: REGISTER_SAGA_STEPS.TOKENS_GENERATED,
            });
         } catch (error: unknown) {
            this.logger.error('Failed to update saga token generation checkpoint', error);
         }
      }
   }

   async complete(): Promise<void> {
      if (this.sagaRepository && this.sagaId) {
         try {
            await this.sagaRepository.updateInstanceStatus(this.sagaId, SAGA_STATUS.COMPLETED, {
               step: null,
            });
         } catch (error: unknown) {
            this.logger.error('Failed to mark saga registration as completed', error);
         }
      }
   }

   async rollback(): Promise<void> {
      if (!this.account) {
         return;
      }

      this.logger.warn(
         `Compensating transaction: rolling back registration flow for account ${this.account.accountId}`,
      );

      if (this.sagaRepository && this.sagaId) {
         try {
            await this.sagaRepository.updateInstanceStatus(this.sagaId, SAGA_STATUS.COMPENSATING);
         } catch (err: unknown) {
            this.logger.error('Failed to update saga status to COMPENSATING', err);
         }
      }

      // Step 1: Revoke all generated tokens (if any)
      if (this.tokens) {
         try {
            await this.tokenLifecycleService.revokeAllAccountTokens(this.account.accountId);
         } catch (error: unknown) {
            this.logger.error(
               `RegisterSaga compensation failed: Unable to revoke tokens for account ${this.account.accountId}`,
               error instanceof Error ? error.stack : error,
            );
         }
      }

      // Step 2: Cancel pending outbox events to prevent phantom emails
      if (this.outboxRepository) {
         try {
            await this.outboxRepository.deleteByAggregateId(this.account.accountId);
         } catch (error: unknown) {
            this.logger.error(
               `RegisterSaga compensation failed: Unable to delete outbox events for account ${this.account.accountId}`,
               error instanceof Error ? error.stack : error,
            );
         }
      }

      // Step 3: Zero-rollback lifecycle transition - mark REGISTRATION_ABORTED instead of hard delete
      try {
         await this.accountRepository.update(this.account.accountId, {
            status: USER_STATUS.REGISTRATION_ABORTED,
         });
         this.logger.log(`Account ${this.account.accountId} marked as ${USER_STATUS.REGISTRATION_ABORTED}`);
      } catch (error: unknown) {
         this.logger.error(
            `RegisterSaga compensation failed: Unable to mark account ${this.account.accountId} as ${USER_STATUS.REGISTRATION_ABORTED}`,
            error instanceof Error ? error.stack : error,
         );
      }

      // Step 4: Record compensation completed in saga repository
      if (this.sagaRepository && this.sagaId) {
         try {
            await this.sagaRepository.updateInstanceStatus(this.sagaId, SAGA_STATUS.COMPENSATED, {
               error: 'Registration aborted and compensated successfully',
            });
         } catch (err: unknown) {
            this.logger.error('Failed to update saga status to COMPENSATED', err);
         }
      }
   }
}
