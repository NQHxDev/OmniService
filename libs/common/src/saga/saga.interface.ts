import type { SagaRecoveryOutcome, SagaStatus, SagaStepStatus, SagaType } from '@common/saga/saga-state.enum';

export interface ISagaStep<TContext> {
   name: string;
   execute: (context: TContext) => Promise<void | Partial<TContext>>;
   compensate: (context: TContext, error: unknown) => Promise<void>;
   retryable?: boolean;
   maxRetries?: number;
}

export interface ISagaInstance<TContext = unknown> {
   sagaId: string;
   sagaType: SagaType;
   aggregateId: string;
   currentState: SagaStatus;
   currentStep?: string | null;
   payload: TContext;
   retryCount: number;
   maxRetries: number;
   timeoutAt: Date;
   lastError?: string | null;
   createdAt: Date;
   updatedAt: Date;
}

export interface ISagaStepLog {
   stepLogId: string;
   sagaId: string;
   stepName: string;
   status: SagaStepStatus;
   payload?: unknown;
   error?: string | null;
   durationMs?: number | null;
   createdAt: Date;
}

export interface CreateSagaInstanceDto<TContext> {
   sagaId?: string;
   sagaType: SagaType;
   aggregateId: string;
   initialPayload: TContext;
   timeoutMs?: number;
   maxRetries?: number;
}

export interface UpdateSagaOptions<TContext> {
   step?: string | null;
   payload?: TContext;
   error?: string | null;
   retryCount?: number;
   timeoutAt?: Date;
}

export interface CreateSagaStepLogDto {
   sagaId: string;
   stepName: string;
   status: SagaStepStatus;
   payload?: unknown;
   error?: string | null;
   durationMs?: number | null;
}

export interface ISagaRepository {
   createInstance<T>(dto: CreateSagaInstanceDto<T>): Promise<ISagaInstance<T>>;
   findInstanceById<T>(sagaId: string): Promise<ISagaInstance<T> | null>;
   findInstanceByAggregateId<T>(aggregateId: string, sagaType: SagaType): Promise<ISagaInstance<T> | null>;
   updateInstanceStatus<T>(sagaId: string, status: SagaStatus, options?: UpdateSagaOptions<T>): Promise<void>;
   recordStepLog(dto: CreateSagaStepLogDto): Promise<void>;
   findStuckSagas(threshold: Date, limit?: number): Promise<ISagaInstance[]>;
}

export const SAGA_REPOSITORY = Symbol('SAGA_REPOSITORY');

export interface SagaCoordinatorOptions {
   defaultStepTimeoutMs?: number;
   defaultMaxRetries?: number;
}

export interface ISagaRecoverer<TContext extends object = Record<string, unknown>> {
   recoverInstance(
      instance: ISagaInstance<TContext>,
      stepRegistry: Map<string, ISagaStep<TContext>>,
   ): Promise<SagaRecoveryOutcome>;
}
