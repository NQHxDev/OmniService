import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommonConfigService, ENV_KEYS } from '@common';
import { AuthEnvConfig, AUTH_ENV_KEYS } from '@auth/config/auth-env.schema';

@Injectable()
export class AuthConfigService extends CommonConfigService {
   constructor(protected override readonly configService: ConfigService<AuthEnvConfig, true>) {
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

   get jwtExpiresIn(): number {
      return this.configService.get(ENV_KEYS.JWT_EXPIRES_IN, { infer: true });
   }

   override get jwtPrivateKeyPath(): string {
      return this.configService.get(ENV_KEYS.JWT_PRIVATE_KEY_PATH, { infer: true }) || 'apps/auth/keys/private.key';
   }

   override get jwtPublicKeyPath(): string {
      return this.configService.get(ENV_KEYS.JWT_PUBLIC_KEY_PATH, { infer: true }) || 'apps/auth/keys/public.key';
   }

   get argon2Secret(): string {
      return (
         this.configService.get(AUTH_ENV_KEYS.ARGON2_SECRET, { infer: true }) ||
         this.configService.get(AUTH_ENV_KEYS.ARGON2_SALT, { infer: true }) ||
         'e0c4b72d523ecbe77e9ddde48f96042c0e4cc8fe596f35809446125fa0714002'
      );
   }

   get refreshTokenSecret(): string {
      return this.configService.get(AUTH_ENV_KEYS.REFRESH_TOKEN_SECRET, { infer: true });
   }

   get port(): number {
      return this.configService.get(AUTH_ENV_KEYS.PORT, { infer: true });
   }

   get grpcPort(): number {
      return this.configService.get(AUTH_ENV_KEYS.GRPC_PORT, { infer: true });
   }

   get grpcUrl(): string {
      return `0.0.0.0:${this.grpcPort}`;
   }
}
