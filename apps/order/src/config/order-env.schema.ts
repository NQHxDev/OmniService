import { z } from 'zod';
import { sharedEnvSchema } from '@common';

export const ORDER_ENV_KEYS = {
   PORT: 'PORT',
   GRPC_PORT: 'GRPC_PORT',
   DATABASE_URL: 'DATABASE_URL',
   POSTGRES_PORT: 'POSTGRES_PORT',
   COMMERCE_GRPC_URL: 'COMMERCE_GRPC_URL',
   PAYMENT_GRPC_URL: 'PAYMENT_GRPC_URL',
} as const;

export type OrderEnvKey = (typeof ORDER_ENV_KEYS)[keyof typeof ORDER_ENV_KEYS];

export const orderEnvSchema = sharedEnvSchema.extend({
   SERVICE_NAME: z.string().default('order-service'),
   POSTGRES_USER: z.string().default('postgres'),
   POSTGRES_PASSWORD: z.string().default('postgres'),
   POSTGRES_DB: z.string().default('omni_service_order'),
   POSTGRES_PORT: z.coerce.number().int().positive().default(5445),
   PGBOUNCER_PORT: z.coerce.number().int().positive().default(6432),
   DATABASE_URL: z
      .string()
      .default(
         'postgresql://postgres:postgres@localhost:6432/omni_service_order?connection_limit=5&pool_timeout=10&pgbouncer=true',
      ),
   DIRECT_URL: z.string().optional(),
   PORT: z.coerce.number().int().positive().default(3009),
   GRPC_PORT: z.coerce.number().int().positive().default(50057),
   COMMERCE_GRPC_URL: z.string().default('localhost:50053'),
   PAYMENT_GRPC_URL: z.string().default('localhost:50058'),
});

export type OrderEnvConfig = z.infer<typeof orderEnvSchema>;

export function validateOrderEnv(config: Record<string, unknown>): OrderEnvConfig {
   const parsed = orderEnvSchema.safeParse(config);
   if (!parsed.success) {
      const formattedErrors = parsed.error.issues
         .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
         .join('\n');
      throw new Error(`Order environment validation error:\n${formattedErrors}`);
   }
   return parsed.data;
}
