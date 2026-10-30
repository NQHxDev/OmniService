import { z } from 'zod';
import { sharedEnvSchema } from '@common';

export const analyzeEnvSchema = sharedEnvSchema.extend({
   SERVICE_NAME: z.string().default('analyze-service'),
   POSTGRES_USER: z.string().default('postgres'),
   POSTGRES_PASSWORD: z.string().default('postgres'),
   POSTGRES_DB: z.string().default('omni_service_analyze'),
   POSTGRES_PORT: z.coerce.number().int().positive().default(5448),
   PGBOUNCER_PORT: z.coerce.number().int().positive().default(6432),
   DATABASE_URL: z
      .string()
      .default(
         'postgresql://postgres:postgres@localhost:6432/omni_service_analyze?connection_limit=5&pool_timeout=10&pgbouncer=true',
      ),
   DIRECT_URL: z.string().optional(),
   PORT: z.coerce.number().int().positive().default(3012),
   GRPC_PORT: z.coerce.number().int().positive().default(50061),
});

export type AnalyzeEnvConfig = z.infer<typeof analyzeEnvSchema>;

export function validateAnalyzeEnv(config: Record<string, unknown>): AnalyzeEnvConfig {
   const parsed = analyzeEnvSchema.safeParse(config);
   if (!parsed.success) {
      const formattedErrors = parsed.error.issues
         .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
         .join('\n');
      throw new Error(`Analyze environment validation error:\n${formattedErrors}`);
   }
   return parsed.data;
}
