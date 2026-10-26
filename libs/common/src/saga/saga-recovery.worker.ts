import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SAGA_ERROR_CODES, SAGA_EVENTS, SAGA_RECOVERY_OUTCOMES, SAGA_STATUS } from '@common/saga/saga-state.enum';
import { PersistentSagaCoordinator } from '@common/saga/persistent-saga-coordinator';
import { SAGA_REPOSITORY, type ISagaInstance, type ISagaRepository, type ISagaStep } from '@common/saga/saga.interface';

export interface RecoveryWorkerOptions {
   pollIntervalMs?: number;
   stuckThresholdMs?: number;
   batchSize?: number;
}

@Injectable()
export class SagaRecoveryWorker<TContext extends object = Record<string, unknown>>
   implements OnModuleInit, OnModuleDestroy
{
   private readonly logger = new Logger(SagaRecoveryWorker.name);
   private pollTimer: NodeJS.Timeout | null = null;
   private isScanning = false;
   private readonly pollIntervalMs: number;
   private readonly stuckThresholdMs: number;
   private readonly batchSize: number;
   private readonly stepRegistries = new Map<string, Map<string, ISagaStep<TContext>>>();

   constructor(
      @Inject(SAGA_REPOSITORY)
      private readonly sagaRepository: ISagaRepository,
      private readonly coordinator: PersistentSagaCoordinator<TContext>,
      @Optional()
      private readonly eventEmitter?: EventEmitter2,
      @Optional()
      options?: RecoveryWorkerOptions,
   ) {
      this.pollIntervalMs = options?.pollIntervalMs ?? 10000;
      this.stuckThresholdMs = options?.stuckThresholdMs ?? 0;
      this.batchSize = options?.batchSize ?? 50;
   }

   onModuleInit(): void {
      this.startPolling();
   }

   onModuleDestroy(): void {
      this.stopPolling();
   }

   registerStep(sagaType: string, step: ISagaStep<TContext>): void {
      if (!this.stepRegistries.has(sagaType)) {
         this.stepRegistries.set(sagaType, new Map());
      }
      this.stepRegistries.get(sagaType)!.set(step.name, step);
   }

   startPolling(): void {
      if (this.pollTimer) return;
      this.logger.log(`Starting SagaRecoveryWorker poller (interval: ${this.pollIntervalMs}ms)`);
      this.pollTimer = setInterval(() => {
         void this.scanAndRecover();
      }, this.pollIntervalMs);
   }

   stopPolling(): void {
      if (this.pollTimer) {
         clearInterval(this.pollTimer);
         this.pollTimer = null;
         this.logger.log('SagaRecoveryWorker poller stopped');
      }
   }

   async triggerScan(): Promise<number> {
      return this.scanAndRecover();
   }

   async scanAndRecover(): Promise<number> {
      if (this.isScanning) {
         return 0;
      }
      this.isScanning = true;

      try {
         const threshold = new Date(Date.now() - this.stuckThresholdMs);
         const stuckSagas = await this.sagaRepository.findStuckSagas(threshold, this.batchSize);

         if (stuckSagas.length === 0) {
            return 0;
         }

         this.logger.warn(`Found ${stuckSagas.length} stuck saga(s) requiring recovery`);

         let recoveredCount = 0;
         for (const instance of stuckSagas) {
            try {
               await this.processRecovery(instance);
               recoveredCount++;
            } catch (err: unknown) {
               this.logger.error(
                  `Recovery failed for saga ${instance.sagaId} (${instance.sagaType})`,
                  err instanceof Error ? err.stack : undefined,
               );
            }
         }

         return recoveredCount;
      } catch (scanError: unknown) {
         this.logger.error(
            'Error during SagaRecoveryWorker scan',
            scanError instanceof Error ? scanError.stack : undefined,
         );
         return 0;
      } finally {
         this.isScanning = false;
      }
   }

   private async processRecovery(instance: ISagaInstance<unknown>): Promise<void> {
      const stepRegistry = this.stepRegistries.get(instance.sagaType) ?? new Map<string, ISagaStep<TContext>>();
      const outcome = await this.coordinator.recoverInstance(
         instance as unknown as ISagaInstance<TContext>,
         stepRegistry,
      );

      this.logger.log(`Saga ${instance.sagaId} recovery outcome: ${outcome}`);

      if (this.eventEmitter) {
         this.eventEmitter.emit(SAGA_EVENTS.RECOVERED, {
            sagaId: instance.sagaId,
            sagaType: instance.sagaType,
            aggregateId: instance.aggregateId,
            outcome,
         });
      }

      if (outcome === SAGA_RECOVERY_OUTCOMES.FAILED) {
         await this.sagaRepository.updateInstanceStatus(instance.sagaId, SAGA_STATUS.FAILED, {
            error: `${SAGA_ERROR_CODES.RECOVERY_FAILED}: automated recovery exhausted; requires manual investigation`,
         });
      }
   }
}
