import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import {
   DEFAULT_JWT_ALGORITHM,
   DEFAULT_JWT_AUDIENCE,
   DEFAULT_JWT_ISSUER,
   DEFAULT_JWT_KEY_ID,
} from '@common/constants/jwt.constant';
import { isProduction, NODE_ENV_VALUES } from '@common/constants/environment.constant';

export const sharedEnvSchema = z.object({
   NODE_ENV: z
      .enum([NODE_ENV_VALUES.DEVELOPMENT, NODE_ENV_VALUES.PRODUCTION, NODE_ENV_VALUES.TEST])
      .default(NODE_ENV_VALUES.DEVELOPMENT),
   SERVICE_NAME: z.string().default('omni-service'),

   LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
   JWT_PUBLIC_KEY_PATH: z.string().optional(),
   JWT_PRIVATE_KEY_PATH: z.string().optional(),
   JWT_PUBLIC_KEY: z.string().optional(),
   JWT_PRIVATE_KEY: z.string().optional(),
   JWT_KEY_ID: z.string().default(DEFAULT_JWT_KEY_ID),
   JWT_ALGORITHM: z.string().default(DEFAULT_JWT_ALGORITHM),
   JWT_ISSUER: z.string().default(DEFAULT_JWT_ISSUER),
   JWT_AUDIENCE: z.string().default(DEFAULT_JWT_AUDIENCE),
   JWT_SECRET: z.string().optional(),
   JWT_REFRESH_SECRET: z.string().optional(),
   JWT_ACCESS_TOKEN_EXPIRES_IN: z.coerce.number().int().positive().default(900),
   JWT_REFRESH_TOKEN_EXPIRES_IN: z.coerce.number().int().positive().default(604800),
   JWT_EXPIRES_IN: z.coerce.number().int().positive().default(900),
   COOKIE_ACCESS_TOKEN_NAME: z.string().default('access_token'),
   COOKIE_REFRESH_TOKEN_NAME: z.string().default('refresh_token'),
   COOKIE_ACCESS_TOKEN_MAX_AGE: z.coerce.number().int().positive().default(900000),
   COOKIE_REFRESH_TOKEN_MAX_AGE: z.coerce.number().int().positive().default(604800000),

   RABBIT_MQ_URI: z.string().default('amqp://guest:guest@localhost:5672'),
   RABBITMQ_URI: z.string().optional(),
   RABBIT_MQ_AUTH_SERVICE_QUEUE: z.string().default('auth_queue'),
   RABBIT_MQ_USER_SERVICE_QUEUE: z.string().default('user_queue'),
   RABBIT_MQ_ORDER_SERVICE_QUEUE: z.string().default('order_queue'),
   RABBIT_MQ_NOTIFICATION_SERVICE_QUEUE: z.string().default('notification_queue'),
   RABBIT_MQ_SEARCH_SERVICE_QUEUE: z.string().default('search_queue'),
   RABBIT_MQ_MEDIA_SERVICE_QUEUE: z.string().default('media_queue'),
   RABBIT_MQ_PAYMENT_SERVICE_QUEUE: z.string().default('payment_queue'),
   RABBIT_MQ_COMMERCE_SERVICE_QUEUE: z.string().default('commerce_queue'),
   RABBIT_MQ_PRODUCT_SERVICE_QUEUE: z.string().default('product_queue'),

   REDIS_HOST: z.string().default('localhost'),
   REDIS_PORT: z.coerce.number().int().positive().default(6379),
   REDIS_PASSWORD: z.string().optional(),

   OTEL_ENABLED: z
      .preprocess((val) => {
         if (typeof val === 'string') {
            return val.toLowerCase() === 'true' || val === '1';
         }
         return val === undefined ? true : Boolean(val);
      }, z.boolean())
      .default(true),
   OTEL_EXPORTER_OTLP_ENDPOINT: z.string().default('http://localhost:4318'),
});

export const baseSharedEnvSchema = sharedEnvSchema;

export const sharedEnvValidationSchema = sharedEnvSchema.superRefine((data, ctx) => {
   if (isProduction(data.NODE_ENV)) {
      const hasPublicKey = Boolean(data.JWT_PUBLIC_KEY && data.JWT_PUBLIC_KEY.trim());
      let hasValidPublicKeyFile = false;
      if (data.JWT_PUBLIC_KEY_PATH) {
         const resolvedPath = path.isAbsolute(data.JWT_PUBLIC_KEY_PATH)
            ? data.JWT_PUBLIC_KEY_PATH
            : path.resolve(process.cwd(), data.JWT_PUBLIC_KEY_PATH);
         try {
            hasValidPublicKeyFile = fs.existsSync(resolvedPath);
         } catch {
            hasValidPublicKeyFile = false;
         }
      }

      if (!hasPublicKey && !hasValidPublicKeyFile) {
         ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
               'FATAL: JWT key missing in production. Provide JWT_PUBLIC_KEY or a valid JWT_PUBLIC_KEY_PATH file.',
            path: ['JWT_PUBLIC_KEY'],
         });
      }
   }
});

export type SharedEnvConfig = z.infer<typeof sharedEnvSchema>;

export function validateSharedEnv(config: Record<string, unknown>): SharedEnvConfig {
   const parsed = sharedEnvValidationSchema.safeParse(config);
   if (!parsed.success) {
      const formattedErrors = parsed.error.issues
         .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
         .join('\n');
      throw new Error(`Shared environment validation error:\n${formattedErrors}`);
   }
   return parsed.data;
}
