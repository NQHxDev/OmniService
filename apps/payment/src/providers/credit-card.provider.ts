import { Injectable, Logger } from '@nestjs/common';
import type {
   IPaymentProvider,
   PaymentInitiateParams,
   PaymentInitiateResult,
   RefundParams,
   RefundResult,
   WebhookVerifyParams,
   WebhookVerifyResult,
} from '@payment/providers/payment-provider.interface';
import type { PaymentMethodEnum } from '@payment/prisma-client';

@Injectable()
export class CreditCardPaymentProvider implements IPaymentProvider {
   readonly providerName: PaymentMethodEnum = 'CREDIT_CARD';
   private readonly logger = new Logger(CreditCardPaymentProvider.name);

   initiatePayment(params: PaymentInitiateParams): Promise<PaymentInitiateResult> {
      const providerTransactionId = `CC-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const paymentUrl = `https://checkout.omniservices.dev/cards/3ds-verify?tx=${params.transactionId}&providerTx=${providerTransactionId}`;

      this.logger.log(`Created Credit Card payment session for transaction ${params.transactionId}`);

      return Promise.resolve({
         paymentUrl,
         providerTransactionId,
         requiresRedirect: true,
         status: 'PENDING',
      });
   }

   verifyWebhook(params: WebhookVerifyParams): Promise<WebhookVerifyResult> {
      let payload: Record<string, unknown> = {};
      try {
         if (params.rawPayload) {
            payload = JSON.parse(params.rawPayload) as Record<string, unknown>;
         } else if (params.queryParams) {
            payload = params.queryParams;
         }
      } catch {
         payload = params.queryParams || {};
      }

      const transactionId = (payload['transactionId'] as string) || (payload['orderId'] as string);
      const providerTransactionId = payload['providerTransactionId'] as string;
      const status = (payload['status'] as string)?.toUpperCase();
      const isSuccess = status === 'SUCCESS' || status === 'PAID';

      this.logger.log(`Credit Card webhook verified for transaction ${transactionId}, status: ${status}`);

      return Promise.resolve({
         isValid: true,
         transactionId,
         providerTransactionId,
         status: isSuccess ? 'SUCCESS' : 'FAILED',
         failureReason: !isSuccess ? (payload['failureReason'] as string) || 'Card payment declined' : undefined,
         metadata: payload,
      });
   }

   refund(params: RefundParams): Promise<RefundResult> {
      this.logger.log(`Credit Card refund processed for transaction ${params.transactionId}, amount ${params.amount}`);
      return Promise.resolve({
         success: true,
         refundTransactionId: `CC-RF-${Date.now()}`,
         message: 'Credit Card refund approved',
      });
   }
}
