import type { PaymentMethodEnum, PaymentStatusEnum } from '@payment/prisma-client';

export interface PaymentInitiateParams {
   transactionId: string;
   orderId: string;
   userId: string;
   amount: number;
   currency: string;
   returnUrl?: string;
   ipAddress?: string;
   orderDescription?: string;
}

export interface PaymentInitiateResult {
   paymentUrl?: string;
   providerTransactionId?: string;
   requiresRedirect: boolean;
   status: PaymentStatusEnum;
}

export interface WebhookVerifyParams {
   rawPayload?: string;
   signature?: string;
   queryParams?: Record<string, string>;
}

export interface WebhookVerifyResult {
   isValid: boolean;
   transactionId?: string;
   providerTransactionId?: string;
   status: PaymentStatusEnum;
   failureReason?: string;
   metadata?: Record<string, unknown>;
}

export interface RefundParams {
   transactionId: string;
   providerTransactionId?: string;
   amount: number;
   reason?: string;
}

export interface RefundResult {
   success: boolean;
   refundTransactionId?: string;
   message?: string;
}

export interface IPaymentProvider {
   readonly providerName: PaymentMethodEnum;
   initiatePayment(params: PaymentInitiateParams): Promise<PaymentInitiateResult>;
   verifyWebhook(params: WebhookVerifyParams): Promise<WebhookVerifyResult>;
   refund(params: RefundParams): Promise<RefundResult>;
}

export const PAYMENT_PROVIDER_FACTORY = Symbol('PAYMENT_PROVIDER_FACTORY');
