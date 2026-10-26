import { z } from 'zod';
import { DEFAULT_JWT_KEY_ID, sharedEnvSchema } from '@common';

export const gatewayEnvSchema = sharedEnvSchema.extend({
   PORT: z.coerce.number().int().positive().default(8080),
   GLOBAL_PREFIX: z.string().default('api/v1'),
   CORS_ORIGINS: z.string().default(''),
   COOKIE_MAX_AGE: z.coerce.number().int().positive().default(86400000),
   THROTTLE_SHORT_TTL: z.coerce.number().int().positive().default(1000),
   THROTTLE_SHORT_LIMIT: z.coerce.number().int().positive().default(10),
   THROTTLE_MEDIUM_TTL: z.coerce.number().int().positive().default(10000),
   THROTTLE_MEDIUM_LIMIT: z.coerce.number().int().positive().default(50),
   THROTTLE_LONG_TTL: z.coerce.number().int().positive().default(60000),
   THROTTLE_LONG_LIMIT: z.coerce.number().int().positive().default(100),
   JWT_PUBLIC_KEY_PATH: z.string().default('apps/gateway/keys/public.key'),
   JWT_KEY_ID: z.string().default(DEFAULT_JWT_KEY_ID),
   AUTH_GRPC_URL: z.string().default('localhost:50051'),
   USER_GRPC_URL: z.string().default('localhost:50052'),
   COMMERCE_GRPC_URL: z.string().default('localhost:50053'),
   SUPPLIER_GRPC_URL: z.string().default('localhost:50054'),
   MEDIA_GRPC_URL: z.string().default('localhost:50055'),
   SEARCH_GRPC_URL: z.string().default('localhost:50056'),
   ORDER_GRPC_URL: z.string().default('localhost:50057'),
   PAYMENT_GRPC_URL: z.string().default('localhost:50058'),
   POST_GRPC_URL: z.string().default('localhost:50059'),
   PRODUCT_GRPC_URL: z.string().default('localhost:50060'),
});

export type GatewayEnvConfig = z.infer<typeof gatewayEnvSchema>;

export function validateGatewayEnv(config: Record<string, unknown>): GatewayEnvConfig {
   const parsed = gatewayEnvSchema.safeParse(config);
   if (!parsed.success) {
      const formattedErrors = parsed.error.issues
         .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
         .join('\n');
      throw new Error(`Gateway environment validation error:\n${formattedErrors}`);
   }
   return parsed.data;
}
