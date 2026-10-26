import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { isProduction, sharedEnvSchema } from '@common';
import { DEFAULT_JWT_KEY_ID } from '@contracts/auth';

export const AUTH_ENV_KEYS = {
   ARGON2_SECRET: 'ARGON2_SECRET',
   ARGON2_SALT: 'ARGON2_SALT',
   PORT: 'PORT',
   GRPC_PORT: 'GRPC_PORT',
   REFRESH_TOKEN_SECRET: 'REFRESH_TOKEN_SECRET',
} as const;

export type AuthEnvKey = (typeof AUTH_ENV_KEYS)[keyof typeof AUTH_ENV_KEYS];

export const authEnvSchema = sharedEnvSchema.extend({
   SERVICE_NAME: z.string().default('auth-service'),
   POSTGRES_USER: z.string().default('postgres'),
   POSTGRES_PASSWORD: z.string().default('postgres'),
   POSTGRES_DB: z.string().default('omni_service_auth'),
   POSTGRES_PORT: z.coerce.number().int().positive().default(5433),
   PGBOUNCER_PORT: z.coerce.number().int().positive().default(6432),
   DATABASE_URL: z
      .string()
      .default(
         'postgresql://postgres:postgres@localhost:6432/omni_service_auth?connection_limit=5&pool_timeout=10&pgbouncer=true',
      ),
   DIRECT_URL: z.string().optional(),
   JWT_PRIVATE_KEY_PATH: z.string().default('apps/auth/keys/private.key'),
   JWT_PUBLIC_KEY_PATH: z.string().default('apps/auth/keys/public.key'),
   JWT_KEY_ID: z.string().default(DEFAULT_JWT_KEY_ID),
   ARGON2_SECRET: z.string().default('default-argon2-secret-key'),
   ARGON2_SALT: z.string().default('default-argon2-salt-key'),
   REFRESH_TOKEN_SECRET: z.string().default('default-refresh-token-secret-must-be-changed-in-prod-32bytes'),
   PORT: z.coerce.number().int().positive().default(3001),
   GRPC_PORT: z.coerce.number().int().positive().default(50051),
});

export const authEnvValidationSchema = authEnvSchema.superRefine((data, ctx) => {
   if (isProduction(data.NODE_ENV)) {
      const hasPrivateKey = Boolean(data.JWT_PRIVATE_KEY && data.JWT_PRIVATE_KEY.trim());
      let hasValidPrivateKeyFile = false;
      if (data.JWT_PRIVATE_KEY_PATH) {
         const resolvedPath = path.isAbsolute(data.JWT_PRIVATE_KEY_PATH)
            ? data.JWT_PRIVATE_KEY_PATH
            : path.resolve(process.cwd(), data.JWT_PRIVATE_KEY_PATH);
         try {
            hasValidPrivateKeyFile = fs.existsSync(resolvedPath);
         } catch {
            hasValidPrivateKeyFile = false;
         }
      }

      if (!hasPrivateKey && !hasValidPrivateKeyFile) {
         ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
               'FATAL: JWT key missing in production. Provide JWT_PRIVATE_KEY or a valid JWT_PRIVATE_KEY_PATH file.',
            path: ['JWT_PRIVATE_KEY'],
         });
      }
   }
});

export type AuthEnvConfig = z.infer<typeof authEnvSchema>;

export function validateAuthEnv(config: Record<string, unknown>): AuthEnvConfig {
   const parsed = authEnvValidationSchema.safeParse(config);
   if (!parsed.success) {
      const formattedErrors = parsed.error.issues
         .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
         .join('\n');
      throw new Error(`Auth environment validation error:\n${formattedErrors}`);
   }
   return parsed.data;
}
