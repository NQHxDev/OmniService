export const ORDER_STATUS = {
   PENDING: 'PENDING',
   AWAITING_PAYMENT: 'AWAITING_PAYMENT',
   CONFIRMED: 'CONFIRMED',
   PROCESSING: 'PROCESSING',
   SHIPPING: 'SHIPPING',
   DELIVERED: 'DELIVERED',
   COMPLETED: 'COMPLETED',
   CANCELLED: 'CANCELLED',
   REFUNDED: 'REFUNDED',
} as const;

export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];

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
