import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommonConfigService, ENV_KEYS } from '@common';
import { UserEnvConfig, USER_ENV_KEYS } from '@user/config/user-env.schema';

@Injectable()
export class UserConfigService extends CommonConfigService {
   constructor(protected override readonly configService: ConfigService<UserEnvConfig, true>) {
      super(configService);
   }

   get databaseUrl(): string {
      return this.configService.get(ENV_KEYS.DATABASE_URL, { infer: true });
   }

   get port(): number {
      return this.configService.get(USER_ENV_KEYS.PORT, { infer: true });
   }

   get grpcPort(): number {
      return this.configService.get(USER_ENV_KEYS.GRPC_PORT, { infer: true });
   }

   get grpcUrl(): string {
      return `0.0.0.0:${this.grpcPort}`;
   }

   get directUrl(): string | undefined {
      return this.configService.get(ENV_KEYS.DIRECT_URL, { infer: true });
   }

   get pgbouncerPort(): number {
      return this.configService.get(ENV_KEYS.PGBOUNCER_PORT, { infer: true });
   }

   get database() {
      return {
         url: this.databaseUrl,
         directUrl: this.directUrl,
         pgbouncerPort: this.pgbouncerPort,
      };
   }

   get nebula() {
      const username = this.configService.get(USER_ENV_KEYS.NEBULA_USERNAME, { infer: true }) || 'root';
      const password = this.configService.get(USER_ENV_KEYS.NEBULA_PASSWORD, { infer: true }) || 'nebula';
      return {
         graphAddress: this.configService.get(USER_ENV_KEYS.NEBULA_GRAPHD_HOST, { infer: true }) || '127.0.0.1',
         graphPort: Number(this.configService.get(USER_ENV_KEYS.NEBULA_GRAPHD_PORT, { infer: true }) || 9669),
         username,
         password,
         space: this.configService.get(USER_ENV_KEYS.NEBULA_SPACE, { infer: true }) || 'social_graph',
         adminUsername: this.configService.get(USER_ENV_KEYS.NEBULA_ADMIN_USERNAME, { infer: true }) || 'root',
         adminPassword: this.configService.get(USER_ENV_KEYS.NEBULA_ADMIN_PASSWORD, { infer: true }) || 'nebula',
         storagedHost: this.configService.get(USER_ENV_KEYS.NEBULA_STORAGED_HOST, { infer: true }) || 'nebula-storaged',
         storagedPort: Number(this.configService.get(USER_ENV_KEYS.NEBULA_STORAGED_PORT, { infer: true }) || 9779),
      };
   }

   get searchGrpcUrl(): string {
      return this.configService.get(USER_ENV_KEYS.SEARCH_GRPC_URL, { infer: true }) || 'localhost:50056';
   }

   get mediaGrpcUrl(): string {
      return this.configService.get(USER_ENV_KEYS.MEDIA_GRPC_URL, { infer: true }) || 'localhost:50055';
   }
}
