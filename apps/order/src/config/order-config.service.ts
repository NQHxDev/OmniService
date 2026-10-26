import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommonConfigService, ENV_KEYS } from '@common';
import { ORDER_ENV_KEYS, type OrderEnvConfig } from '@order/config/order-env.schema';

@Injectable()
export class OrderConfigService extends CommonConfigService {
   constructor(protected override readonly configService: ConfigService<OrderEnvConfig, true>) {
      super(configService);
   }

   get port(): number {
      return this.configService.get(ORDER_ENV_KEYS.PORT, { infer: true });
   }

   get grpcPort(): number {
      return this.configService.get(ORDER_ENV_KEYS.GRPC_PORT, { infer: true });
   }

   get grpcUrl(): string {
      return `0.0.0.0:${this.grpcPort}`;
   }

   get databaseUrl(): string {
      return this.configService.get(ORDER_ENV_KEYS.DATABASE_URL, { infer: true });
   }

   get directUrl(): string | undefined {
      return this.configService.get(ENV_KEYS.DIRECT_URL, { infer: true });
   }

   get pgbouncerPort(): number {
      return this.configService.get(ENV_KEYS.PGBOUNCER_PORT, { infer: true });
   }

   get commerceGrpcUrl(): string {
      return this.configService.get(ORDER_ENV_KEYS.COMMERCE_GRPC_URL, { infer: true });
   }

   get paymentGrpcUrl(): string {
      return this.configService.get(ORDER_ENV_KEYS.PAYMENT_GRPC_URL, { infer: true });
   }
}
