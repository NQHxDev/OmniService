import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommonConfigService, ENV_KEYS } from '@common';
import { COMMERCE_ENV_KEYS, type CommerceEnvConfig } from '@commerce/config/commerce-env.schema';

@Injectable()
export class CommerceConfigService extends CommonConfigService {
   constructor(protected override readonly configService: ConfigService<CommerceEnvConfig, true>) {
      super(configService);
   }

   get port(): number {
      return this.configService.get(COMMERCE_ENV_KEYS.PORT, { infer: true });
   }

   get grpcPort(): number {
      return this.configService.get(COMMERCE_ENV_KEYS.GRPC_PORT, { infer: true });
   }

   get grpcUrl(): string {
      return `0.0.0.0:${this.grpcPort}`;
   }

   get databaseUrl(): string {
      return this.configService.get(COMMERCE_ENV_KEYS.DATABASE_URL, { infer: true });
   }

   get directUrl(): string | undefined {
      return this.configService.get(ENV_KEYS.DIRECT_URL, { infer: true });
   }

   get pgbouncerPort(): number {
      return this.configService.get(ENV_KEYS.PGBOUNCER_PORT, { infer: true });
   }

   get supplierGrpcUrl(): string {
      return this.configService.get(COMMERCE_ENV_KEYS.SUPPLIER_GRPC_URL, { infer: true });
   }
}
