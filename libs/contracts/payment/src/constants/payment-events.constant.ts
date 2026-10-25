export const PAYMENT_EVENTS = {
   PAYMENT_INITIATED: 'payment.initiated',
   PAYMENT_SUCCEEDED: 'payment.succeeded',
   PAYMENT_FAILED: 'payment.failed',
   PAYMENT_COD_PENDING: 'payment.cod_pending',
   PAYMENT_REFUNDED: 'payment.refunded',
} as const;

export type PaymentEvent = (typeof PAYMENT_EVENTS)[keyof typeof PAYMENT_EVENTS];

export interface IPaymentInitiatedEvent {
   transactionId: string;
   orderId: string;
   userId: string;
   amount: number;
   currency: string;
   paymentMethod: string;
   createdAt: string;
}

export interface IPaymentSucceededEvent {
   transactionId: string;
   orderId: string;
   userId: string;
   amount: number;
   currency: string;
   paymentMethod: string;
   providerTransactionId?: string;
   completedAt: string;
}

export interface IPaymentFailedEvent {
   transactionId: string;
   orderId: string;
   userId: string;
   amount: number;
   paymentMethod: string;
   failureReason: string;
   failedAt: string;
}

export interface IPaymentCodPendingEvent {
   transactionId: string;
   orderId: string;
   userId: string;
   amount: number;
   createdAt: string;
}

export interface IPaymentRefundedEvent {
   transactionId: string;
   orderId: string;
   userId: string;
   refundId: string;
   amount: number;
   refundedAt: string;
}
