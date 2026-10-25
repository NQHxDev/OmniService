import { z } from 'zod';
import { sharedEnvSchema } from '@common';

export const postEnvSchema = sharedEnvSchema.extend({
   SERVICE_NAME: z.string().default('post-service'),
   POSTGRES_USER: z.string().default('postgres'),
   POSTGRES_PASSWORD: z.string().default('postgres'),
   POSTGRES_DB: z.string().default('omni_service_post'),
   POSTGRES_PORT: z.coerce.number().int().positive().default(5441),
   PGBOUNCER_PORT: z.coerce.number().int().positive().default(6432),
   DATABASE_URL: z
      .string()
      .default(
         'postgresql://postgres:postgres@localhost:6432/omni_service_post?connection_limit=5&pool_timeout=10&pgbouncer=true',
      ),
   DIRECT_URL: z.string().optional(),
   PORT: z.coerce.number().int().positive().default(3009),
   GRPC_PORT: z.coerce.number().int().positive().default(50059),
});

export type PostEnvConfig = z.infer<typeof postEnvSchema>;

export function validatePostEnv(config: Record<string, unknown>): PostEnvConfig {
   const parsed = postEnvSchema.safeParse(config);
   if (!parsed.success) {
      const formattedErrors = parsed.error.issues
         .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
         .join('\n');
      throw new Error(`Post environment validation error:\n${formattedErrors}`);
   }
   return parsed.data;
}
