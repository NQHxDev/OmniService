import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommonConfigService, ENV_KEYS } from '@common';
import { AnalyzeEnvConfig } from '@analyze/config/analyze-env.schema';

@Injectable()
export class AnalyzeConfigService extends CommonConfigService {
   constructor(protected override readonly configService: ConfigService<AnalyzeEnvConfig, true>) {
      super(configService);
   }

   get databaseUrl(): string {
      return this.configService.get(ENV_KEYS.DATABASE_URL, { infer: true });
   }

   get directUrl(): string | undefined {
      return this.configService.get(ENV_KEYS.DIRECT_URL, { infer: true });
   }

   get pgbouncerPort(): number {
      return this.configService.get(ENV_KEYS.PGBOUNCER_PORT, { infer: true });
   }

   get postgresUser(): string {
      return this.configService.get(ENV_KEYS.POSTGRES_USER, { infer: true });
   }

   get postgresPassword(): string {
      return this.configService.get(ENV_KEYS.POSTGRES_PASSWORD, { infer: true });
   }

   get postgresDb(): string {
      return this.configService.get(ENV_KEYS.POSTGRES_DB, { infer: true });
   }

   get postgresPort(): number {
      return this.configService.get(ENV_KEYS.POSTGRES_PORT, { infer: true });
   }

   get port(): number {
      return this.configService.get('PORT' as keyof AnalyzeEnvConfig, { infer: true });
   }

   get grpcPort(): number {
      return this.configService.get('GRPC_PORT' as keyof AnalyzeEnvConfig, { infer: true });
   }

   get grpcUrl(): string {
      return `0.0.0.0:${this.grpcPort}`;
   }
}
