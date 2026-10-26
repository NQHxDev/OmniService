export const SAGA_STATUS = {
   STARTED: 'STARTED',
   EXECUTING: 'EXECUTING',
   COMPENSATING: 'COMPENSATING',
   COMPENSATED: 'COMPENSATED',
   COMPLETED: 'COMPLETED',
   FAILED: 'FAILED',
} as const;

export type SagaStatus = (typeof SAGA_STATUS)[keyof typeof SAGA_STATUS];

export const SAGA_STEP_STATUS = {
   PENDING: 'PENDING',
   EXECUTING: 'EXECUTING',
   SUCCEEDED: 'SUCCEEDED',
   FAILED: 'FAILED',
   COMPENSATING: 'COMPENSATING',
   COMPENSATED: 'COMPENSATED',
   COMPENSATION_FAILED: 'COMPENSATION_FAILED',
} as const;

export type SagaStepStatus = (typeof SAGA_STEP_STATUS)[keyof typeof SAGA_STEP_STATUS];

export const SAGA_TYPES = {
   USER_REGISTRATION: 'USER_REGISTRATION',
   FOLLOW_GRAPH_SYNC: 'FOLLOW_GRAPH_SYNC',
   SUPPLIER_ONBOARDING: 'SUPPLIER_ONBOARDING',
   ORDER_CHECKOUT: 'ORDER_CHECKOUT',
} as const;

export type SagaType = (typeof SAGA_TYPES)[keyof typeof SAGA_TYPES] | (string & {});

export const SAGA_EVENTS = {
   STARTED: 'saga.started',
   STEP_SUCCEEDED: 'saga.step_succeeded',
   STEP_FAILED: 'saga.step_failed',
   COMPENSATING: 'saga.compensating',
   COMPENSATED: 'saga.compensated',
   COMPLETED: 'saga.completed',
   FAILED: 'saga.failed',
   RECOVERED: 'saga.recovered',
} as const;

export type SagaEventName = (typeof SAGA_EVENTS)[keyof typeof SAGA_EVENTS];

export const SAGA_ERROR_CODES = {
   COMPENSATION_FAILED: 'SAGA.COMPENSATION_FAILED',
   TIMEOUT_EXCEEDED: 'SAGA.TIMEOUT_EXCEEDED',
   RECOVERY_FAILED: 'SAGA.RECOVERY_FAILED',
   STEP_EXECUTION_FAILED: 'SAGA.STEP_EXECUTION_FAILED',
} as const;

export type SagaErrorCode = (typeof SAGA_ERROR_CODES)[keyof typeof SAGA_ERROR_CODES];

export const SAGA_RECOVERY_OUTCOMES = {
   RECOVERED: 'RECOVERED',
   COMPENSATED: 'COMPENSATED',
   FAILED: 'FAILED',
} as const;

export type SagaRecoveryOutcome = (typeof SAGA_RECOVERY_OUTCOMES)[keyof typeof SAGA_RECOVERY_OUTCOMES];
