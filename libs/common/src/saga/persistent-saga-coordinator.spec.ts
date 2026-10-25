import { EventEmitter2 } from '@nestjs/event-emitter';
import { SAGA_RECOVERY_OUTCOMES, SAGA_STATUS, SAGA_STEP_STATUS, SAGA_TYPES } from '@common/saga/saga-state.enum';
import { InMemorySagaRepository } from '@common/saga/in-memory-saga.repository';
import { PersistentSagaCoordinator, SagaCompensationError } from '@common/saga/persistent-saga-coordinator';
import { SagaRecoveryWorker } from '@common/saga/saga-recovery.worker';

interface TestContext {
   userId: string;
   email: string;
   accountCreated?: boolean;
   tokensIssued?: boolean;
   cacheWarmed?: boolean;
   compensatedSteps: string[];
}

describe('PersistentSagaCoordinator & SEC Engine', () => {
   let repository: InMemorySagaRepository;
   let coordinator: PersistentSagaCoordinator<TestContext>;
   let eventEmitter: EventEmitter2;

   beforeEach(() => {
      repository = new InMemorySagaRepository();
      eventEmitter = new EventEmitter2();
      coordinator = new PersistentSagaCoordinator<TestContext>(repository, eventEmitter);
   });

   describe('Happy Path (Deterministic Forward Execution)', () => {
      it('should execute all steps sequentially, persist checkpoints, and mark saga COMPLETED', async () => {
         coordinator
            .addStep({
               name: 'create_account',
               execute: async (ctx) => {
                  await Promise.resolve();
                  ctx.accountCreated = true;
                  return { accountCreated: true };
               },
               compensate: async (ctx) => {
                  await Promise.resolve();
                  ctx.compensatedSteps.push('create_account');
               },
            })
            .addStep({
               name: 'generate_tokens',
               execute: async (ctx) => {
                  await Promise.resolve();
                  ctx.tokensIssued = true;
                  return { tokensIssued: true };
               },
               compensate: async (ctx) => {
                  await Promise.resolve();
                  ctx.compensatedSteps.push('generate_tokens');
               },
            })
            .addStep({
               name: 'warmup_cache',
               execute: async (ctx) => {
                  await Promise.resolve();
                  ctx.cacheWarmed = true;
                  return { cacheWarmed: true };
               },
               compensate: async (ctx) => {
                  await Promise.resolve();
                  ctx.compensatedSteps.push('warmup_cache');
               },
            });

         const initialContext: TestContext = {
            userId: 'usr-123',
            email: 'test@example.com',
            compensatedSteps: [],
         };

         const result = await coordinator.execute({
            sagaType: SAGA_TYPES.USER_REGISTRATION,
            aggregateId: 'usr-123',
            initialContext,
         });

         expect(result.accountCreated).toBe(true);
         expect(result.tokensIssued).toBe(true);
         expect(result.cacheWarmed).toBe(true);
         expect(result.compensatedSteps).toHaveLength(0);

         const instance = await repository.findInstanceByAggregateId<TestContext>(
            'usr-123',
            SAGA_TYPES.USER_REGISTRATION,
         );
         expect(instance).toBeDefined();
         expect(instance?.currentState).toBe(SAGA_STATUS.COMPLETED);
         expect(instance?.currentStep).toBeNull();
         expect(instance?.payload.accountCreated).toBe(true);

         const logs = repository.getLogsForSaga(instance!.sagaId);
         const succeededLogs = logs.filter((l) => l.status === SAGA_STEP_STATUS.SUCCEEDED);
         expect(succeededLogs).toHaveLength(3);
         expect(succeededLogs.map((l) => l.stepName)).toEqual(['create_account', 'generate_tokens', 'warmup_cache']);
      });
   });

   describe('Backward Recovery (LIFO Compensation)', () => {
      it('should compensate executed steps in reverse order when a step fails, marking COMPENSATED', async () => {
         const compensationOrder: string[] = [];

         coordinator
            .addStep({
               name: 'step1_db_account',
               execute: async (ctx) => {
                  await Promise.resolve();
                  ctx.accountCreated = true;
               },
               compensate: async () => {
                  await Promise.resolve();
                  compensationOrder.push('step1_db_account');
               },
            })
            .addStep({
               name: 'step2_token_gen',
               execute: async (ctx) => {
                  await Promise.resolve();
                  ctx.tokensIssued = true;
               },
               compensate: async () => {
                  await Promise.resolve();
                  compensationOrder.push('step2_token_gen');
               },
            })
            .addStep({
               name: 'step3_failing_external_call',
               execute: async () => {
                  await Promise.resolve();
                  throw new Error('External service timeout');
               },
               compensate: async () => {
                  await Promise.resolve();
                  compensationOrder.push('step3_failing_external_call');
               },
            });

         await expect(
            coordinator.execute({
               sagaId: 'saga-comp-1',
               sagaType: SAGA_TYPES.USER_REGISTRATION,
               aggregateId: 'usr-456',
               initialContext: {
                  userId: 'usr-456',
                  email: 'fail@example.com',
                  compensatedSteps: [],
               },
            }),
         ).rejects.toThrow('External service timeout');

         // Compensation executes for executed steps in reverse order: step2 then step1 (step 3 never succeeded)
         expect(compensationOrder).toEqual(['step2_token_gen', 'step1_db_account']);

         const instance = await repository.findInstanceById<TestContext>('saga-comp-1');
         expect(instance?.currentState).toBe(SAGA_STATUS.COMPENSATED);
         expect(instance?.lastError).toContain('External service timeout');
      });

      it('should mark saga as FAILED and throw SagaCompensationError if a compensation step fails', async () => {
         coordinator
            .addStep({
               name: 'step1_fragile_compensation',
               execute: async () => {
                  await Promise.resolve();
               },
               compensate: async () => {
                  await Promise.resolve();
                  throw new Error('Database connection lost during compensation');
               },
            })
            .addStep({
               name: 'step2_exploding_step',
               execute: async () => {
                  await Promise.resolve();
                  throw new Error('Business rule violation');
               },
               compensate: async () => {
                  await Promise.resolve();
               },
            });

         await expect(
            coordinator.execute({
               sagaId: 'saga-comp-fail',
               sagaType: SAGA_TYPES.USER_REGISTRATION,
               aggregateId: 'usr-fail',
               initialContext: {
                  userId: 'usr-fail',
                  email: 'fatal@example.com',
                  compensatedSteps: [],
               },
            }),
         ).rejects.toThrow(SagaCompensationError);

         const instance = await repository.findInstanceById('saga-comp-fail');
         expect(instance?.currentState).toBe(SAGA_STATUS.FAILED);
         expect(instance?.lastError).toContain('Compensation failed on 1 steps');
      });
   });

   describe('Automated Recovery & SagaRecoveryWorker', () => {
      it('should perform Forward Recovery for transient failure when retries remain', async () => {
         const instance = await repository.createInstance({
            sagaId: 'saga-stuck-1',
            sagaType: SAGA_TYPES.USER_REGISTRATION,
            aggregateId: 'usr-stuck',
            initialPayload: { userId: 'usr-stuck', email: 'stuck@example.com', compensatedSteps: [] },
            timeoutMs: 1000,
            maxRetries: 3,
         });

         await repository.updateInstanceStatus('saga-stuck-1', SAGA_STATUS.EXECUTING, {
            step: 'generate_tokens',
            retryCount: 0,
         });

         const outcome = await coordinator.recoverInstance(instance, new Map());
         expect(outcome).toBe(SAGA_RECOVERY_OUTCOMES.RECOVERED);

         const updated = await repository.findInstanceById('saga-stuck-1');
         expect(updated?.retryCount).toBe(1);
         expect(updated?.currentState).toBe(SAGA_STATUS.EXECUTING);
      });

      it('should perform Backward Recovery when max retries are exhausted', async () => {
         let compensated = false;
         coordinator.addStep({
            name: 'account_provision',
            execute: async () => {
               await Promise.resolve();
            },
            compensate: async () => {
               await Promise.resolve();
               compensated = true;
            },
         });

         await repository.createInstance({
            sagaId: 'saga-exhausted',
            sagaType: SAGA_TYPES.USER_REGISTRATION,
            aggregateId: 'usr-exhausted',
            initialPayload: { userId: 'usr-exhausted', email: 'exhausted@example.com', compensatedSteps: [] },
            timeoutMs: 1000,
            maxRetries: 2,
         });

         await repository.updateInstanceStatus('saga-exhausted', SAGA_STATUS.EXECUTING, {
            step: 'account_provision',
            retryCount: 2, // Already at max retries
         });

         const updatedInstance = await repository.findInstanceById<TestContext>('saga-exhausted');
         const outcome = await coordinator.recoverInstance(updatedInstance!, new Map());
         expect(outcome).toBe(SAGA_RECOVERY_OUTCOMES.COMPENSATED);
         expect(compensated).toBe(true);

         const finalInstance = await repository.findInstanceById('saga-exhausted');
         expect(finalInstance?.currentState).toBe(SAGA_STATUS.COMPENSATED);
      });

      it('should allow SagaRecoveryWorker to scan and recover stuck sagas', async () => {
         const worker = new SagaRecoveryWorker(repository, coordinator, eventEmitter, {
            pollIntervalMs: 5000,
            stuckThresholdMs: 0,
            batchSize: 10,
         });

         // Create a stuck instance with timeout in the past
         const now = Date.now();
         await repository.createInstance({
            sagaId: 'saga-worker-test',
            sagaType: SAGA_TYPES.USER_REGISTRATION,
            aggregateId: 'usr-worker',
            initialPayload: { userId: 'usr-worker', email: 'worker@example.com', compensatedSteps: [] },
            timeoutMs: -10000, // already expired
            maxRetries: 3,
         });

         await repository.updateInstanceStatus('saga-worker-test', SAGA_STATUS.EXECUTING, {
            step: 'create_account',
            timeoutAt: new Date(now - 5000),
         });

         const recovered = await worker.triggerScan();
         expect(recovered).toBe(1);

         const resultInstance = await repository.findInstanceById('saga-worker-test');
         expect(resultInstance?.retryCount).toBe(1);
      });
   });
});
