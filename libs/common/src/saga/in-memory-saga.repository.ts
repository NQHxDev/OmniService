import { Injectable } from '@nestjs/common';
import { uuidv7 } from '@common/utils';
import { SAGA_STATUS, type SagaStatus, type SagaType } from '@common/saga/saga-state.enum';
import type {
   CreateSagaInstanceDto,
   CreateSagaStepLogDto,
   ISagaInstance,
   ISagaRepository,
   ISagaStepLog,
   UpdateSagaOptions,
} from '@common/saga/saga.interface';

@Injectable()
export class InMemorySagaRepository implements ISagaRepository {
   private readonly instances = new Map<string, ISagaInstance<unknown>>();
   private readonly stepLogs = new Map<string, ISagaStepLog[]>();

   async createInstance<T>(dto: CreateSagaInstanceDto<T>): Promise<ISagaInstance<T>> {
      await Promise.resolve();
      const sagaId = dto.sagaId ?? uuidv7();
      const now = new Date();
      const timeoutMs = dto.timeoutMs ?? 30000;
      const timeoutAt = new Date(now.getTime() + timeoutMs);

      const instance: ISagaInstance<T> = {
         sagaId,
         sagaType: dto.sagaType,
         aggregateId: dto.aggregateId,
         currentState: SAGA_STATUS.STARTED,
         currentStep: null,
         payload: structuredClone(dto.initialPayload),
         retryCount: 0,
         maxRetries: dto.maxRetries ?? 3,
         timeoutAt,
         lastError: null,
         createdAt: now,
         updatedAt: now,
      };

      this.instances.set(sagaId, instance);
      this.stepLogs.set(sagaId, []);
      return structuredClone(instance);
   }

   async findInstanceById<T>(sagaId: string): Promise<ISagaInstance<T> | null> {
      await Promise.resolve();
      const instance = this.instances.get(sagaId);
      if (!instance) {
         return null;
      }
      return structuredClone(instance) as ISagaInstance<T>;
   }

   async findInstanceByAggregateId<T>(aggregateId: string, sagaType: SagaType): Promise<ISagaInstance<T> | null> {
      await Promise.resolve();
      for (const instance of this.instances.values()) {
         if (instance.aggregateId === aggregateId && instance.sagaType === sagaType) {
            return structuredClone(instance) as ISagaInstance<T>;
         }
      }
      return null;
   }

   async updateInstanceStatus<T>(sagaId: string, status: SagaStatus, options?: UpdateSagaOptions<T>): Promise<void> {
      await Promise.resolve();
      const instance = this.instances.get(sagaId);
      if (!instance) {
         return;
      }

      instance.currentState = status;
      instance.updatedAt = new Date();

      if (options?.step !== undefined) {
         instance.currentStep = options.step;
      }
      if (options?.payload !== undefined) {
         instance.payload = structuredClone(options.payload);
      }
      if (options?.error !== undefined) {
         instance.lastError = options.error;
      }
      if (options?.retryCount !== undefined) {
         instance.retryCount = options.retryCount;
      }
      if (options?.timeoutAt !== undefined) {
         instance.timeoutAt = options.timeoutAt;
      }
   }

   async recordStepLog(dto: CreateSagaStepLogDto): Promise<void> {
      await Promise.resolve();
      const logs = this.stepLogs.get(dto.sagaId) ?? [];
      const stepLog: ISagaStepLog = {
         stepLogId: uuidv7(),
         sagaId: dto.sagaId,
         stepName: dto.stepName,
         status: dto.status,
         payload: dto.payload !== undefined ? structuredClone(dto.payload) : undefined,
         error: dto.error ?? null,
         durationMs: dto.durationMs ?? null,
         createdAt: new Date(),
      };
      logs.push(stepLog);
      this.stepLogs.set(dto.sagaId, logs);
   }

   async findStuckSagas(threshold: Date, limit = 50): Promise<ISagaInstance[]> {
      await Promise.resolve();
      const stuckList: ISagaInstance[] = [];
      const terminalStates = new Set<SagaStatus>([SAGA_STATUS.COMPLETED, SAGA_STATUS.COMPENSATED, SAGA_STATUS.FAILED]);

      for (const instance of this.instances.values()) {
         if (!terminalStates.has(instance.currentState) && instance.timeoutAt < threshold) {
            stuckList.push(structuredClone(instance));
            if (stuckList.length >= limit) {
               break;
            }
         }
      }

      return stuckList;
   }

   // Helper for testing
   getLogsForSaga(sagaId: string): ISagaStepLog[] {
      return structuredClone(this.stepLogs.get(sagaId) ?? []);
   }

   clear(): void {
      this.instances.clear();
      this.stepLogs.clear();
   }
}
