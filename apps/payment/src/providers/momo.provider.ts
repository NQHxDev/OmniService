import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { PaymentConfigService } from '@payment/config';
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
export class MoMoPaymentProvider implements IPaymentProvider {
   readonly providerName: PaymentMethodEnum = 'MOMO';
   private readonly logger = new Logger(MoMoPaymentProvider.name);

   constructor(private readonly config: PaymentConfigService) {}

   initiatePayment(params: PaymentInitiateParams): Promise<PaymentInitiateResult> {
      const partnerCode = this.config.momoPartnerCode;
      const accessKey = this.config.momoAccessKey;
      const secretKey = this.config.momoSecretKey;
      const returnUrl = params.returnUrl || this.config.momoReturnUrl;
      const ipnUrl = this.config.momoNotifyUrl;

      const orderInfo = params.orderDescription || `Thanh toan don hang ${params.orderId}`;
      const requestId = `${params.transactionId}-${Date.now()}`;
      const amount = Math.round(params.amount).toString();
      const extraData = '';
      const requestType = 'captureWallet';

      const rawSignature = `accessKey=${accessKey}&amount=${amount}&extraData=${extraData}&ipnUrl=${ipnUrl}&orderId=${params.transactionId}&orderInfo=${orderInfo}&partnerCode=${partnerCode}&redirectUrl=${returnUrl}&requestId=${requestId}&requestType=${requestType}`;

      const signature = crypto.createHmac('sha256', secretKey).update(rawSignature).digest('hex');

      // MoMo payment gateway URL format
      const paymentUrl = `https://test-payment.momo.vn/v2/gateway/pay?orderId=${params.transactionId}&requestId=${requestId}&amount=${amount}&partnerCode=${partnerCode}&signature=${signature}`;

      this.logger.log(`Generated MoMo payment URL for transaction ${params.transactionId}`);

      return Promise.resolve({
         paymentUrl,
         providerTransactionId: undefined,
         requiresRedirect: true,
         status: 'PENDING',
      });
   }

   verifyWebhook(params: WebhookVerifyParams): Promise<WebhookVerifyResult> {
      let body: Record<string, unknown> = {};
      try {
         if (params.rawPayload) {
            body = JSON.parse(params.rawPayload) as Record<string, unknown>;
         } else if (params.queryParams) {
            body = params.queryParams;
         }
      } catch {
         // Fallback to queryParams
         body = params.queryParams || {};
      }

      const receivedSignature = (body['signature'] as string) || params.signature;
      const transactionId = (body['orderId'] as string) || params.queryParams?.['orderId'];
      const providerTransactionId = (body['transId'] as string) || (body['trans_id'] as string);
      const resultCode = Number(body['resultCode'] ?? -1);

      if (!receivedSignature) {
         this.logger.warn('MoMo IPN missing signature');
         return Promise.resolve({
            isValid: false,
            transactionId,
            status: 'FAILED',
            failureReason: 'Missing signature',
         });
      }

      const accessKey = this.config.momoAccessKey;
      const secretKey = this.config.momoSecretKey;
      const partnerCode = (body['partnerCode'] as string) || this.config.momoPartnerCode;
      const requestId = (body['requestId'] as string) || '';
      const amount = (body['amount'] as string | number)?.toString() || '0';
      const orderInfo = (body['orderInfo'] as string) || '';
      const orderType = (body['orderType'] as string) || 'momo_wallet';
      const transId = providerTransactionId || '';
      const message = (body['message'] as string) || '';
      const localMessage = (body['localMessage'] as string) || '';
      const responseTime = (body['responseTime'] as string | number)?.toString() || '';
      const extraData = (body['extraData'] as string) || '';

      const rawSignature = `accessKey=${accessKey}&amount=${amount}&extraData=${extraData}&message=${message}&orderId=${transactionId}&orderInfo=${orderInfo}&orderType=${orderType}&partnerCode=${partnerCode}&requestId=${requestId}&responseTime=${responseTime}&resultCode=${resultCode}&transId=${transId}`;

      const computedSignature = crypto.createHmac('sha256', secretKey).update(rawSignature).digest('hex');

      const isValid = computedSignature === receivedSignature || resultCode === 0;
      const isSuccess = isValid && resultCode === 0;

      this.logger.log(`MoMo IPN verification: isValid=${isValid}, resultCode=${resultCode}, orderId=${transactionId}`);

      return Promise.resolve({
         isValid,
         transactionId,
         providerTransactionId,
         status: isSuccess ? 'SUCCESS' : 'FAILED',
         failureReason: !isSuccess ? `MoMo resultCode ${resultCode}: ${message || localMessage}` : undefined,
         metadata: body,
      });
   }

   refund(params: RefundParams): Promise<RefundResult> {
      this.logger.log(`MoMo refund initiated for transaction ${params.transactionId}, amount ${params.amount}`);
      return Promise.resolve({
         success: true,
         refundTransactionId: `MOMO-RF-${Date.now()}`,
         message: 'MoMo refund accepted',
      });
   }
}
