export const PAYMENT_METHODS = {
   COD: 'COD',
   CREDIT_CARD: 'CREDIT_CARD',
   VNPAY: 'VNPAY',
   MOMO: 'MOMO',
} as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[keyof typeof PAYMENT_METHODS];

export const PAYMENT_STATUS = {
   PENDING: 'PENDING',
   PROCESSING: 'PROCESSING',
   SUCCESS: 'SUCCESS',
   FAILED: 'FAILED',
   CANCELLED: 'CANCELLED',
   REFUNDED: 'REFUNDED',
} as const;

export type PaymentStatus = (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS];

export const PAYMENT_PROVIDERS = {
   COD: 'COD',
   VNPAY: 'VNPAY',
   MOMO: 'MOMO',
   STRIPE: 'STRIPE',
} as const;

export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[keyof typeof PAYMENT_PROVIDERS];
