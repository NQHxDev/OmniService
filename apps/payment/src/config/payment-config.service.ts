import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommonConfigService, ENV_KEYS } from '@common';
import { PAYMENT_ENV_KEYS, type PaymentEnvConfig } from '@payment/config/payment-env.schema';

@Injectable()
export class PaymentConfigService extends CommonConfigService {
   constructor(protected override readonly configService: ConfigService<PaymentEnvConfig, true>) {
      super(configService);
   }

   get port(): number {
      return this.configService.get(PAYMENT_ENV_KEYS.PORT, { infer: true });
   }

   get grpcPort(): number {
      return this.configService.get(PAYMENT_ENV_KEYS.GRPC_PORT, { infer: true });
   }

   get grpcUrl(): string {
      return `0.0.0.0:${this.grpcPort}`;
   }

   get databaseUrl(): string {
      return this.configService.get(PAYMENT_ENV_KEYS.DATABASE_URL, { infer: true });
   }

   get directUrl(): string | undefined {
      return this.configService.get(ENV_KEYS.DIRECT_URL, { infer: true });
   }

   get pgbouncerPort(): number {
      return this.configService.get(ENV_KEYS.PGBOUNCER_PORT, { infer: true });
   }

   get orderGrpcUrl(): string {
      return this.configService.get(PAYMENT_ENV_KEYS.ORDER_GRPC_URL, { infer: true });
   }

   get vnpayTmnCode(): string {
      return this.configService.get(PAYMENT_ENV_KEYS.VNPAY_TMN_CODE, { infer: true });
   }

   get vnpayHashSecret(): string {
      return this.configService.get(PAYMENT_ENV_KEYS.VNPAY_HASH_SECRET, { infer: true });
   }

   get vnpayUrl(): string {
      return this.configService.get(PAYMENT_ENV_KEYS.VNPAY_URL, { infer: true });
   }

   get vnpayReturnUrl(): string {
      return this.configService.get(PAYMENT_ENV_KEYS.VNPAY_RETURN_URL, { infer: true });
   }

   get momoPartnerCode(): string {
      return this.configService.get(PAYMENT_ENV_KEYS.MOMO_PARTNER_CODE, { infer: true });
   }

   get momoAccessKey(): string {
      return this.configService.get(PAYMENT_ENV_KEYS.MOMO_ACCESS_KEY, { infer: true });
   }

   get momoSecretKey(): string {
      return this.configService.get(PAYMENT_ENV_KEYS.MOMO_SECRET_KEY, { infer: true });
   }

   get momoEndpoint(): string {
      return this.configService.get(PAYMENT_ENV_KEYS.MOMO_ENDPOINT, { infer: true });
   }

   get momoReturnUrl(): string {
      return this.configService.get(PAYMENT_ENV_KEYS.MOMO_RETURN_URL, { infer: true });
   }

   get momoNotifyUrl(): string {
      return this.configService.get(PAYMENT_ENV_KEYS.MOMO_NOTIFY_URL, { infer: true });
   }
}
