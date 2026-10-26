import { z } from 'zod';
import { sharedEnvSchema } from '@common';

export const PRODUCT_ENV_KEYS = {
   PORT: 'PORT',
   GRPC_PORT: 'GRPC_PORT',
   DATABASE_URL: 'DATABASE_URL',
   POSTGRES_PORT: 'POSTGRES_PORT',
} as const;

export type ProductEnvKey = (typeof PRODUCT_ENV_KEYS)[keyof typeof PRODUCT_ENV_KEYS];

export const productEnvSchema = sharedEnvSchema.extend({
   SERVICE_NAME: z.string().default('product-service'),
   POSTGRES_USER: z.string().default('postgres'),
   POSTGRES_PASSWORD: z.string().default('postgres'),
   POSTGRES_DB: z.string().default('omni_service_product'),
   POSTGRES_PORT: z.coerce.number().int().positive().default(5447),
   PGBOUNCER_PORT: z.coerce.number().int().positive().default(6432),
   DATABASE_URL: z
      .string()
      .default(
         'postgresql://postgres:postgres@localhost:6432/omni_service_product?connection_limit=5&pool_timeout=10&pgbouncer=true',
      ),
   DIRECT_URL: z.string().optional(),
   PORT: z.coerce.number().int().positive().default(3011),
   GRPC_PORT: z.coerce.number().int().positive().default(50060),
});

export type ProductEnvConfig = z.infer<typeof productEnvSchema>;

export function validateProductEnv(config: Record<string, unknown>): ProductEnvConfig {
   const parsed = productEnvSchema.safeParse(config);
   if (!parsed.success) {
      const formattedErrors = parsed.error.issues
         .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
         .join('\n');
      throw new Error(`Product environment validation error:\n${formattedErrors}`);
   }
   return parsed.data;
}
