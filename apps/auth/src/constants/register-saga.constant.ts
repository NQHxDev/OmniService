export const REGISTER_SAGA_STEPS = {
   ACCOUNT_PROVISIONED: 'ACCOUNT_PROVISIONED',
   TOKENS_GENERATED: 'TOKENS_GENERATED',
} as const;

export type RegisterSagaStep = (typeof REGISTER_SAGA_STEPS)[keyof typeof REGISTER_SAGA_STEPS];

export const REGISTER_SAGA_NAMES = {
   REGISTER: 'RegisterSaga',
} as const;

export type RegisterSagaName = (typeof REGISTER_SAGA_NAMES)[keyof typeof REGISTER_SAGA_NAMES];
