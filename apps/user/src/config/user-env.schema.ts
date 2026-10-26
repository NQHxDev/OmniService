import { z } from 'zod';
import { sharedEnvSchema } from '@common';

export const USER_ENV_KEYS = {
   PORT: 'PORT',
   GRPC_PORT: 'GRPC_PORT',
   SERVICE_NAME: 'SERVICE_NAME',
   POSTGRES_USER: 'POSTGRES_USER',
   POSTGRES_PASSWORD: 'POSTGRES_PASSWORD',
   POSTGRES_DB: 'POSTGRES_DB',
   POSTGRES_PORT: 'POSTGRES_PORT',
   DATABASE_URL: 'DATABASE_URL',
   NEBULA_GRAPHD_HOST: 'NEBULA_GRAPHD_HOST',
   NEBULA_GRAPHD_PORT: 'NEBULA_GRAPHD_PORT',
   NEBULA_USERNAME: 'NEBULA_USERNAME',
   NEBULA_PASSWORD: 'NEBULA_PASSWORD',
   NEBULA_SPACE: 'NEBULA_SPACE',
   NEBULA_ADMIN_USERNAME: 'NEBULA_ADMIN_USERNAME',
   NEBULA_ADMIN_PASSWORD: 'NEBULA_ADMIN_PASSWORD',
   NEBULA_STORAGED_HOST: 'NEBULA_STORAGED_HOST',
   NEBULA_STORAGED_PORT: 'NEBULA_STORAGED_PORT',
   SEARCH_GRPC_URL: 'SEARCH_GRPC_URL',
   MEDIA_GRPC_URL: 'MEDIA_GRPC_URL',
} as const;

export type UserEnvKey = (typeof USER_ENV_KEYS)[keyof typeof USER_ENV_KEYS];

export const userEnvSchema = sharedEnvSchema.extend({
   PORT: z.coerce.number().int().positive().default(3002),
   GRPC_PORT: z.coerce.number().int().positive().default(50052),
   SERVICE_NAME: z.string().default('user-service'),
   POSTGRES_USER: z.string().default('postgres'),
   POSTGRES_PASSWORD: z.string().default('postgres'),
   POSTGRES_DB: z.string().default('omni_service_user'),
   POSTGRES_PORT: z.coerce.number().int().positive().default(5439),
   PGBOUNCER_PORT: z.coerce.number().int().positive().default(6432),
   DATABASE_URL: z
      .string()
      .default(
         'postgresql://postgres:postgres@localhost:6432/omni_service_user?connection_limit=5&pool_timeout=10&pgbouncer=true',
      ),
   DIRECT_URL: z.string().optional(),
   NEBULA_GRAPHD_HOST: z.string().default('localhost'),
   NEBULA_GRAPHD_PORT: z.coerce.number().int().positive().default(9669),
   NEBULA_USERNAME: z.string().default('root'),
   NEBULA_PASSWORD: z.string().default('nebula'),
   NEBULA_SPACE: z.string().default('social_graph'),
   NEBULA_ADMIN_USERNAME: z.string().default('root'),
   NEBULA_ADMIN_PASSWORD: z.string().default('nebula'),
   NEBULA_STORAGED_HOST: z.string().default('nebula-storaged'),
   NEBULA_STORAGED_PORT: z.coerce.number().int().positive().default(9779),
   SEARCH_GRPC_URL: z.string().default('localhost:50056'),
   MEDIA_GRPC_URL: z.string().default('localhost:50055'),
});

export type UserEnvConfig = z.infer<typeof userEnvSchema>;

export function validateUserEnv(config: Record<string, unknown>): UserEnvConfig {
   const parsed = userEnvSchema.safeParse(config);
   if (!parsed.success) {
      const formattedErrors = parsed.error.issues
         .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
         .join('\n');
      throw new Error(`User environment validation error:\n${formattedErrors}`);
   }
   return parsed.data;
}
