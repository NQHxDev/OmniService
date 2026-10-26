import { z } from 'zod';
import { sharedEnvSchema } from '@common';

export const SUPPLIER_ENV_KEYS = {
   PORT: 'PORT',
   GRPC_PORT: 'GRPC_PORT',
   DATABASE_URL: 'DATABASE_URL',
   POSTGRES_PORT: 'POSTGRES_PORT',
} as const;

export type SupplierEnvKey = (typeof SUPPLIER_ENV_KEYS)[keyof typeof SUPPLIER_ENV_KEYS];

export const supplierEnvSchema = sharedEnvSchema.extend({
   SERVICE_NAME: z.string().default('supplier-service'),
   POSTGRES_USER: z.string().default('postgres'),
   POSTGRES_PASSWORD: z.string().default('postgres'),
   POSTGRES_DB: z.string().default('omni_service_supplier'),
   POSTGRES_PORT: z.coerce.number().int().positive().default(5444),
   PGBOUNCER_PORT: z.coerce.number().int().positive().default(6432),
   DATABASE_URL: z
      .string()
      .default(
         'postgresql://postgres:postgres@localhost:6432/omni_service_supplier?connection_limit=5&pool_timeout=10&pgbouncer=true',
      ),
   DIRECT_URL: z.string().optional(),
   PORT: z.coerce.number().int().positive().default(3008),
   GRPC_PORT: z.coerce.number().int().positive().default(50054),
});

export type SupplierEnvConfig = z.infer<typeof supplierEnvSchema>;

export function validateSupplierEnv(config: Record<string, unknown>): SupplierEnvConfig {
   const parsed = supplierEnvSchema.safeParse(config);
   if (!parsed.success) {
      const formattedErrors = parsed.error.issues
         .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
         .join('\n');
      throw new Error(`Supplier environment validation error:\n${formattedErrors}`);
   }
   return parsed.data;
}
