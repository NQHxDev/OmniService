import { Injectable } from '@nestjs/common';
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
export class CodPaymentProvider implements IPaymentProvider {
   readonly providerName: PaymentMethodEnum = 'COD';

   initiatePayment(params: PaymentInitiateParams): Promise<PaymentInitiateResult> {
      return Promise.resolve({
         providerTransactionId: `COD-${params.transactionId.slice(0, 8).toUpperCase()}`,
         requiresRedirect: false,
         status: 'PENDING',
      });
   }

   verifyWebhook(params: WebhookVerifyParams): Promise<WebhookVerifyResult> {
      let payload: Record<string, unknown> = {};
      try {
         if (params.rawPayload) {
            payload = JSON.parse(params.rawPayload) as Record<string, unknown>;
         }
      } catch {
         // Ignore parse error
      }

      const transactionId = (payload.transactionId as string) || params.queryParams?.['transactionId'];
      const status = (payload.status as string) === 'DELIVERED' ? 'SUCCESS' : 'PENDING';

      return Promise.resolve({
         isValid: true,
         transactionId,
         status,
         metadata: payload,
      });
   }

   refund(params: RefundParams): Promise<RefundResult> {
      return Promise.resolve({
         success: true,
         refundTransactionId: `COD-RF-${Date.now()}`,
         message: `COD manual refund noted for transaction ${params.transactionId}`,
      });
   }
}
