import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { uuidv7 } from '@common/utils';
import {
   SAGA_ERROR_CODES,
   SAGA_EVENTS,
   SAGA_RECOVERY_OUTCOMES,
   SAGA_STATUS,
   SAGA_STEP_STATUS,
   type SagaEventName,
   type SagaRecoveryOutcome,
   type SagaStatus,
   type SagaType,
} from '@common/saga/saga-state.enum';
import {
   SAGA_REPOSITORY,
   type ISagaInstance,
   type ISagaRecoverer,
   type ISagaRepository,
   type ISagaStep,
} from '@common/saga/saga.interface';
import { SagaCompensationError } from '@common/patterns';

export { SagaCompensationError } from '@common/patterns';

export interface ExecuteSagaOptions<TContext> {
   sagaId?: string;
   sagaType: SagaType;
   aggregateId: string;
   initialContext: TContext;
   stepTimeoutMs?: number;
   maxRetries?: number;
}

export interface SagaCoordinatorEventPayload<TContext = unknown> {
   sagaId: string;
   sagaType: SagaType;
   aggregateId: string;
   stepName?: string;
   status: SagaStatus;
   context?: TContext;
   error?: unknown;
}

@Injectable()
export class PersistentSagaCoordinator<
   TContext extends object = Record<string, unknown>,
> implements ISagaRecoverer<TContext> {
   private readonly logger = new Logger(PersistentSagaCoordinator.name);
   private readonly steps: ISagaStep<TContext>[] = [];

   constructor(
      @Inject(SAGA_REPOSITORY)
      private readonly sagaRepository: ISagaRepository,
      @Optional()
      private readonly eventEmitter?: EventEmitter2,
   ) {}

   addStep(step: ISagaStep<TContext>): this {
      this.steps.push(step);
      return this;
   }

   getSteps(): readonly ISagaStep<TContext>[] {
      return this.steps;
   }

   async execute(options: ExecuteSagaOptions<TContext>): Promise<TContext> {
      const sagaId = options.sagaId ?? uuidv7();
      const stepTimeoutMs = options.stepTimeoutMs ?? 30000;
      const maxRetries = options.maxRetries ?? 3;
      const context: TContext = structuredClone(options.initialContext);
      const executedSteps: ISagaStep<TContext>[] = [];

      // 1. Persist Initial Saga Instance
      await this.sagaRepository.createInstance({
         sagaId,
         sagaType: options.sagaType,
         aggregateId: options.aggregateId,
         initialPayload: context,
         timeoutMs: stepTimeoutMs,
         maxRetries,
      });

      this.emitEvent(SAGA_EVENTS.STARTED, {
         sagaId,
         sagaType: options.sagaType,
         aggregateId: options.aggregateId,
         status: SAGA_STATUS.STARTED,
         context,
      });

      // 2. Execute Steps Sequentially with Checkpoints
      for (const step of this.steps) {
         const stepStartTime = Date.now();
         const stepTimeoutAt = new Date(Date.now() + stepTimeoutMs);

         try {
            this.logger.debug(`[${options.sagaType}:${sagaId}] Starting step: ${step.name}`);

            await this.sagaRepository.updateInstanceStatus(sagaId, SAGA_STATUS.EXECUTING, {
               step: step.name,
               timeoutAt: stepTimeoutAt,
            });

            await this.sagaRepository.recordStepLog({
               sagaId,
               stepName: step.name,
               status: SAGA_STEP_STATUS.EXECUTING,
            });

            const stepResult = await step.execute(context);
            if (stepResult && typeof stepResult === 'object') {
               Object.assign(context, stepResult);
            }

            executedSteps.push(step);
            const durationMs = Date.now() - stepStartTime;

            // Checkpoint: step succeeded, store payload snapshot
            await this.sagaRepository.recordStepLog({
               sagaId,
               stepName: step.name,
               status: SAGA_STEP_STATUS.SUCCEEDED,
               durationMs,
               payload: context,
            });

            await this.sagaRepository.updateInstanceStatus(sagaId, SAGA_STATUS.EXECUTING, {
               step: step.name,
               payload: context,
            });

            this.emitEvent(SAGA_EVENTS.STEP_SUCCEEDED, {
               sagaId,
               sagaType: options.sagaType,
               aggregateId: options.aggregateId,
               stepName: step.name,
               status: SAGA_STATUS.EXECUTING,
               context,
            });
         } catch (stepError: unknown) {
            const durationMs = Date.now() - stepStartTime;
            const errorMessage = stepError instanceof Error ? stepError.message : String(stepError);

            this.logger.error(
               `[${options.sagaType}:${sagaId}] Step "${step.name}" failed: ${errorMessage}. Initiating persistent compensation...`,
               stepError instanceof Error ? stepError.stack : undefined,
            );

            await this.sagaRepository.recordStepLog({
               sagaId,
               stepName: step.name,
               status: SAGA_STEP_STATUS.FAILED,
               durationMs,
               error: errorMessage,
            });

            await this.compensate(sagaId, options.sagaType, options.aggregateId, executedSteps, context, stepError);
            throw stepError;
         }
      }

      // 3. Mark Saga as Completed
      await this.sagaRepository.updateInstanceStatus(sagaId, SAGA_STATUS.COMPLETED, {
         step: null,
         payload: context,
      });

      this.logger.debug(`[${options.sagaType}:${sagaId}] Saga completed successfully`);
      this.emitEvent(SAGA_EVENTS.COMPLETED, {
         sagaId,
         sagaType: options.sagaType,
         aggregateId: options.aggregateId,
         status: SAGA_STATUS.COMPLETED,
         context,
      });

      return context;
   }

   /**
    * Backward Compensation (LIFO Order)
    */
   private async compensate(
      sagaId: string,
      sagaType: SagaType,
      aggregateId: string,
      executedSteps: ISagaStep<TContext>[],
      context: TContext,
      originalError: unknown,
   ): Promise<void> {
      const originalErrorMessage = originalError instanceof Error ? originalError.message : String(originalError);

      await this.sagaRepository.updateInstanceStatus(sagaId, SAGA_STATUS.COMPENSATING, {
         error: originalErrorMessage,
      });

      this.emitEvent(SAGA_EVENTS.COMPENSATING, {
         sagaId,
         sagaType,
         aggregateId,
         status: SAGA_STATUS.COMPENSATING,
         context,
         error: originalError,
      });

      const compensationErrors: Array<{ stepName: string; error: unknown }> = [];

      for (const step of [...executedSteps].reverse()) {
         const compStartTime = Date.now();
         try {
            this.logger.debug(`[${sagaType}:${sagaId}] Compensating step: ${step.name}`);

            await this.sagaRepository.recordStepLog({
               sagaId,
               stepName: step.name,
               status: SAGA_STEP_STATUS.COMPENSATING,
            });

            await step.compensate(context, originalError);

            await this.sagaRepository.recordStepLog({
               sagaId,
               stepName: step.name,
               status: SAGA_STEP_STATUS.COMPENSATED,
               durationMs: Date.now() - compStartTime,
            });
         } catch (compError: unknown) {
            const compErrorMessage = compError instanceof Error ? compError.message : String(compError);
            this.logger.error(
               `[${sagaType}:${sagaId}] Compensation failed for step "${step.name}": ${compErrorMessage}`,
               compError instanceof Error ? compError.stack : undefined,
            );

            await this.sagaRepository.recordStepLog({
               sagaId,
               stepName: step.name,
               status: SAGA_STEP_STATUS.COMPENSATION_FAILED,
               durationMs: Date.now() - compStartTime,
               error: compErrorMessage,
            });

            compensationErrors.push({ stepName: step.name, error: compError });
         }
      }

      if (compensationErrors.length > 0) {
         await this.sagaRepository.updateInstanceStatus(sagaId, SAGA_STATUS.FAILED, {
            error: `Compensation failed on ${compensationErrors.length} steps: ${compensationErrors.map((e) => e.stepName).join(', ')}`,
         });

         this.emitEvent(SAGA_EVENTS.FAILED, {
            sagaId,
            sagaType,
            aggregateId,
            status: SAGA_STATUS.FAILED,
            context,
            error: compensationErrors,
         });

         throw new SagaCompensationError(
            `Saga [${sagaType}:${sagaId}] finished with ${compensationErrors.length} compensation failure(s)`,
            originalError,
            compensationErrors,
         );
      }

      await this.sagaRepository.updateInstanceStatus(sagaId, SAGA_STATUS.COMPENSATED, {
         error: originalErrorMessage,
      });

      this.emitEvent(SAGA_EVENTS.COMPENSATED, {
         sagaId,
         sagaType,
         aggregateId,
         status: SAGA_STATUS.COMPENSATED,
         context,
      });
   }

   /**
    * Recovery logic invoked by SagaRecoveryWorker for stuck or failed sagas.
    */
   async recoverInstance(
      instance: ISagaInstance<TContext>,
      stepRegistry: Map<string, ISagaStep<TContext>>,
   ): Promise<SagaRecoveryOutcome> {
      const { sagaId, sagaType, aggregateId, currentState, retryCount, maxRetries, payload } = instance;
      this.logger.warn(`[${sagaType}:${sagaId}] Attempting automated recovery from state "${currentState}"`);

      // If already in COMPENSATING state: complete backward compensation
      if (currentState === SAGA_STATUS.COMPENSATING) {
         const executedSteps = this.resolveExecutedSteps(instance, stepRegistry);
         try {
            await this.compensate(
               sagaId,
               sagaType,
               aggregateId,
               executedSteps,
               payload,
               new Error(SAGA_ERROR_CODES.COMPENSATION_FAILED),
            );
            return SAGA_RECOVERY_OUTCOMES.COMPENSATED;
         } catch {
            return SAGA_RECOVERY_OUTCOMES.FAILED;
         }
      }

      // If stuck in STARTED or EXECUTING state:
      if (currentState === SAGA_STATUS.STARTED || currentState === SAGA_STATUS.EXECUTING) {
         if (retryCount < maxRetries) {
            // Forward recovery: Increment retry count and resume execution
            await this.sagaRepository.updateInstanceStatus(sagaId, SAGA_STATUS.EXECUTING, {
               retryCount: retryCount + 1,
               timeoutAt: new Date(Date.now() + 30000),
            });
            this.logger.log(
               `[${sagaType}:${sagaId}] Forward recovery scheduled (retry ${retryCount + 1}/${maxRetries})`,
            );
            return SAGA_RECOVERY_OUTCOMES.RECOVERED;
         }

         // Max retries exceeded: Fallback to Backward Recovery
         this.logger.warn(
            `[${sagaType}:${sagaId}] Max retries exceeded (${retryCount}/${maxRetries}). Triggering backward recovery`,
         );
         const executedSteps = this.resolveExecutedSteps(instance, stepRegistry);
         try {
            await this.compensate(
               sagaId,
               sagaType,
               aggregateId,
               executedSteps,
               payload,
               new Error(`${SAGA_ERROR_CODES.TIMEOUT_EXCEEDED}: max retries (${maxRetries}) exceeded`),
            );
            return SAGA_RECOVERY_OUTCOMES.COMPENSATED;
         } catch {
            return SAGA_RECOVERY_OUTCOMES.FAILED;
         }
      }

      return SAGA_RECOVERY_OUTCOMES.FAILED;
   }

   private resolveExecutedSteps(
      instance: ISagaInstance<TContext>,
      stepRegistry: Map<string, ISagaStep<TContext>>,
   ): ISagaStep<TContext>[] {
      if (!instance.currentStep) {
         return [];
      }
      const steps: ISagaStep<TContext>[] = [];
      for (const step of this.steps) {
         steps.push(step);
         if (step.name === instance.currentStep) {
            break;
         }
      }
      return steps.length > 0 ? steps : Array.from(stepRegistry.values());
   }

   private emitEvent(eventName: SagaEventName, payload: SagaCoordinatorEventPayload<TContext>): void {
      if (this.eventEmitter) {
         this.eventEmitter.emit(eventName, payload);
      }
   }
}
