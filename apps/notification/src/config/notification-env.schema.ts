import { z } from 'zod';
import { sharedEnvSchema } from '@common';

export const notificationEnvSchema = sharedEnvSchema.extend({
   SERVICE_NAME: z.string().default('notification-service'),
   RESEND_TOKEN: z.string().default('default_resend_token'),
   RESEND_API_KEY: z.string().optional(),
   EMAIL_FROM: z.string().default('noreply@zeion.online'),
   EMAIL_FROM_NAME: z.string().default('OmniServices'),
   APP_URL: z.string().url().default('https://zeion.online'),
   DATABASE_URL: z
      .string()
      .default(
         'postgresql://postgres:postgres@localhost:6432/omni_service_notification?connection_limit=5&pool_timeout=10&pgbouncer=true',
      ),
   DIRECT_URL: z.string().optional(),
   POSTGRES_USER: z.string().default('postgres'),
   POSTGRES_PASSWORD: z.string().default('postgres'),
   POSTGRES_DB: z.string().default('omni_service_notification'),
   POSTGRES_PORT: z.coerce.number().default(5436),
   PGBOUNCER_PORT: z.coerce.number().int().positive().default(6432),
});

export type NotificationEnvConfig = z.infer<typeof notificationEnvSchema>;

export function validateNotificationEnv(config: Record<string, unknown>): NotificationEnvConfig {
   const parsed = notificationEnvSchema.safeParse(config);
   if (!parsed.success) {
      const formattedErrors = parsed.error.issues
         .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
         .join('\n');
      throw new Error(`Notification environment validation error:\n${formattedErrors}`);
   }
   return parsed.data;
}
