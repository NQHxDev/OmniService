import { z } from 'zod';
import { sharedEnvSchema } from '@common';

export const COMMERCE_ENV_KEYS = {
   PORT: 'PORT',
   GRPC_PORT: 'GRPC_PORT',
   DATABASE_URL: 'DATABASE_URL',
   POSTGRES_PORT: 'POSTGRES_PORT',
   SUPPLIER_GRPC_URL: 'SUPPLIER_GRPC_URL',
} as const;

export type CommerceEnvKey = (typeof COMMERCE_ENV_KEYS)[keyof typeof COMMERCE_ENV_KEYS];

export const commerceEnvSchema = sharedEnvSchema.extend({
   SERVICE_NAME: z.string().default('commerce-service'),
   POSTGRES_USER: z.string().default('postgres'),
   POSTGRES_PASSWORD: z.string().default('postgres'),
   POSTGRES_DB: z.string().default('omni_service_commerce'),
   POSTGRES_PORT: z.coerce.number().int().positive().default(5443),
   PGBOUNCER_PORT: z.coerce.number().int().positive().default(6432),
   DATABASE_URL: z
      .string()
      .default(
         'postgresql://postgres:postgres@localhost:6432/omni_service_commerce?connection_limit=5&pool_timeout=10&pgbouncer=true',
      ),
   DIRECT_URL: z.string().optional(),
   PORT: z.coerce.number().int().positive().default(3007),
   GRPC_PORT: z.coerce.number().int().positive().default(50053),
   SUPPLIER_GRPC_URL: z.string().default('localhost:50054'),
});

export type CommerceEnvConfig = z.infer<typeof commerceEnvSchema>;

export function validateCommerceEnv(config: Record<string, unknown>): CommerceEnvConfig {
   const parsed = commerceEnvSchema.safeParse(config);
   if (!parsed.success) {
      const formattedErrors = parsed.error.issues
         .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
         .join('\n');
      throw new Error(`Commerce environment validation error:\n${formattedErrors}`);
   }
   return parsed.data;
}
