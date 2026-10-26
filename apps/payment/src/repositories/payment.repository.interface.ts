import type { PaymentMethodEnum, PaymentRefund, PaymentStatusEnum, PaymentTransaction } from '@payment/prisma-client';

export interface CreatePaymentTransactionData {
   orderId: string;
   userId: string;
   amount: number;
   currency: string;
   paymentMethod: PaymentMethodEnum;
   paymentStatus?: PaymentStatusEnum;
   paymentUrl?: string;
   providerTransactionId?: string;
   metadata?: Record<string, unknown>;
}

export interface UpdatePaymentStatusData {
   paymentStatus: PaymentStatusEnum;
   providerTransactionId?: string;
   failureReason?: string;
   metadata?: Record<string, unknown>;
}

export interface CreatePaymentRefundData {
   transactionId: string;
   amount: number;
   reason?: string;
}

export interface IPaymentRepository {
   create(data: CreatePaymentTransactionData): Promise<PaymentTransaction>;
   findById(transactionId: string): Promise<PaymentTransaction | null>;
   findByOrderId(orderId: string): Promise<PaymentTransaction | null>;
   updateStatus(transactionId: string, data: UpdatePaymentStatusData): Promise<PaymentTransaction>;
   createRefund(data: CreatePaymentRefundData): Promise<PaymentRefund>;
}

export const PAYMENT_REPOSITORY = Symbol('PAYMENT_REPOSITORY');
