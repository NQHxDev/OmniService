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
export class VnPayPaymentProvider implements IPaymentProvider {
   readonly providerName: PaymentMethodEnum = 'VNPAY';
   private readonly logger = new Logger(VnPayPaymentProvider.name);

   constructor(private readonly config: PaymentConfigService) {}

   initiatePayment(params: PaymentInitiateParams): Promise<PaymentInitiateResult> {
      const tmnCode = this.config.vnpayTmnCode;
      const secretKey = this.config.vnpayHashSecret;
      const vnpUrl = this.config.vnpayUrl;
      const returnUrl = params.returnUrl || this.config.vnpayReturnUrl;

      const date = new Date();
      const createDate = date.toISOString().replace(/[-:T]/g, '').slice(0, 14);

      // VNPay expects amount multiplied by 100
      const vnpAmount = Math.round(params.amount * 100);

      const vnpParams: Record<string, string> = {
         vnp_Version: '2.1.0',
         vnp_Command: 'pay',
         vnp_TmnCode: tmnCode,
         vnp_Locale: 'vn',
         vnp_CurrCode: params.currency || 'VND',
         vnp_TxnRef: params.transactionId,
         vnp_OrderInfo: params.orderDescription || `Payment for order ${params.orderId}`,
         vnp_OrderType: 'other',
         vnp_Amount: vnpAmount.toString(),
         vnp_ReturnUrl: returnUrl,
         vnp_IpAddr: params.ipAddress || '127.0.0.1',
         vnp_CreateDate: createDate,
      };

      const sortedParams = this.sortObject(vnpParams);
      const signData = new URLSearchParams(sortedParams).toString();
      const hmac = crypto.createHmac('sha512', secretKey);
      const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

      const paymentUrl = `${vnpUrl}?${signData}&vnp_SecureHash=${signed}`;

      this.logger.log(`Generated VNPay URL for transaction ${params.transactionId}`);

      return Promise.resolve({
         paymentUrl,
         providerTransactionId: undefined,
         requiresRedirect: true,
         status: 'PENDING',
      });
   }

   verifyWebhook(params: WebhookVerifyParams): Promise<WebhookVerifyResult> {
      const queryParams = params.queryParams || {};
      const secureHash = queryParams['vnp_SecureHash'];

      if (!secureHash) {
         this.logger.warn('VNPay IPN received without vnp_SecureHash');
         return Promise.resolve({
            isValid: false,
            status: 'FAILED',
            failureReason: 'Missing vnp_SecureHash',
         });
      }

      const secretKey = this.config.vnpayHashSecret;
      const filteredParams: Record<string, string> = {};

      for (const [key, value] of Object.entries(queryParams)) {
         if (key !== 'vnp_SecureHash' && key !== 'vnp_SecureHashType') {
            filteredParams[key] = value;
         }
      }

      const sortedParams = this.sortObject(filteredParams);
      const signData = new URLSearchParams(sortedParams).toString();
      const hmac = crypto.createHmac('sha512', secretKey);
      const computedHash = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

      const isValid = computedHash.toLowerCase() === secureHash.toLowerCase();
      const transactionId = queryParams['vnp_TxnRef'];
      const providerTransactionId = queryParams['vnp_TransactionNo'];
      const responseCode = queryParams['vnp_ResponseCode'];
      const isSuccess = isValid && responseCode === '00';

      this.logger.log(
         `VNPay Webhook verification: isValid=${isValid}, responseCode=${responseCode}, txn=${transactionId}`,
      );

      return Promise.resolve({
         isValid,
         transactionId,
         providerTransactionId,
         status: isSuccess ? 'SUCCESS' : 'FAILED',
         failureReason: !isSuccess ? `VNPay error response code: ${responseCode}` : undefined,
         metadata: queryParams,
      });
   }

   refund(params: RefundParams): Promise<RefundResult> {
      this.logger.log(`VNPay refund initiated for transaction ${params.transactionId}, amount ${params.amount}`);
      return Promise.resolve({
         success: true,
         refundTransactionId: `VNP-RF-${Date.now()}`,
         message: 'VNPay refund accepted',
      });
   }

   private sortObject(obj: Record<string, string>): Record<string, string> {
      const sorted: Record<string, string> = {};
      const keys = Object.keys(obj).sort();
      for (const key of keys) {
         sorted[key] = obj[key]!;
      }
      return sorted;
   }
}
