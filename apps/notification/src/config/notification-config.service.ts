import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommonConfigService, ENV_KEYS } from '@common';
import { NotificationEnvConfig } from '@notification/config/notification-env.schema';

@Injectable()
export class NotificationConfigService extends CommonConfigService {
   constructor(protected override readonly configService: ConfigService<NotificationEnvConfig, true>) {
      super(configService);
   }

   get resendToken(): string {
      return (
         this.configService.get(ENV_KEYS.RESEND_TOKEN, { infer: true }) ||
         this.configService.get(ENV_KEYS.RESEND_API_KEY, { infer: true }) ||
         ''
      );
   }

   get emailFrom(): string {
      return this.configService.get(ENV_KEYS.EMAIL_FROM, { infer: true });
   }

   get emailFromName(): string {
      return this.configService.get(ENV_KEYS.EMAIL_FROM_NAME, { infer: true });
   }

   get defaultSender(): string {
      const name = this.emailFromName;
      const from = this.emailFrom;
      return name ? `${name} <${from}>` : from;
   }

   get appUrl(): string {
      return this.configService.get(ENV_KEYS.APP_URL, { infer: true });
   }

   get databaseUrl(): string | undefined {
      return this.configService.get(ENV_KEYS.DATABASE_URL, { infer: true });
   }

   get directUrl(): string | undefined {
      return this.configService.get(ENV_KEYS.DIRECT_URL, { infer: true });
   }

   get pgbouncerPort(): number {
      return this.configService.get(ENV_KEYS.PGBOUNCER_PORT, { infer: true }) || 6432;
   }

   get postgresPort(): number {
      return this.configService.get(ENV_KEYS.POSTGRES_PORT, { infer: true });
   }
}
