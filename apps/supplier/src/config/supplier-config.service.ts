import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommonConfigService, ENV_KEYS } from '@common';
import { SUPPLIER_ENV_KEYS, type SupplierEnvConfig } from '@supplier/config/supplier-env.schema';

@Injectable()
export class SupplierConfigService extends CommonConfigService {
   constructor(protected override readonly configService: ConfigService<SupplierEnvConfig, true>) {
      super(configService);
   }

   get port(): number {
      return this.configService.get(SUPPLIER_ENV_KEYS.PORT, { infer: true });
   }

   get grpcPort(): number {
      return this.configService.get(SUPPLIER_ENV_KEYS.GRPC_PORT, { infer: true });
   }

   get grpcUrl(): string {
      return `0.0.0.0:${this.grpcPort}`;
   }

   get databaseUrl(): string {
      return this.configService.get(SUPPLIER_ENV_KEYS.DATABASE_URL, { infer: true });
   }

   get directUrl(): string | undefined {
      return this.configService.get(ENV_KEYS.DIRECT_URL, { infer: true });
   }

   get pgbouncerPort(): number {
      return this.configService.get(ENV_KEYS.PGBOUNCER_PORT, { infer: true });
   }

   get rabbitmqUri(): string {
      return this.configService.get(ENV_KEYS.RABBITMQ_URI, { infer: true });
   }
}
