import { z } from 'zod';

export const mediaEnvSchema = z.object({
   SERVICE_NAME: z.string().default('media-service'),
   NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
   LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

   // Database
   POSTGRES_USER: z.string().default('postgres'),
   POSTGRES_PASSWORD: z.string().default('postgres'),
   POSTGRES_DB: z.string().default('omni_service_media'),
   POSTGRES_PORT: z.coerce.number().default(5442),
   PGBOUNCER_PORT: z.coerce.number().int().positive().default(6432),
   DATABASE_URL: z
      .string()
      .default(
         'postgresql://postgres:postgres@localhost:6432/omni_service_media?connection_limit=5&pool_timeout=10&pgbouncer=true',
      ),
   DIRECT_URL: z.string().optional(),

   // RabbitMQ
   RABBIT_MQ_URI: z.string().default('amqp://guest:guest@localhost:5672'),
   RABBIT_MQ_MEDIA_SERVICE_QUEUE: z.string().default('media_queue'),

   // Cloudinary
   CLOUDINARY_CLOUD_NAME: z.string().optional(),
   CLOUDINARY_API_KEY: z.string().optional(),
   CLOUDINARY_API_SECRET: z.string().optional(),

   // Cloudflare R2 / S3
   R2_ACCOUNT_ID: z.string().optional(),
   R2_ACCESS_KEY_ID: z.string().optional(),
   R2_SECRET_ACCESS_KEY: z.string().optional(),
   R2_BUCKET_NAME: z.string().optional(),
   R2_ENDPOINT: z.string().optional(),
   R2_PUBLIC_URL: z.string().optional(),

   // gRPC
   GRPC_PORT: z.coerce.number().default(50055),
   GRPC_URL: z.string().default('0.0.0.0:50055'),
});

export const MEDIA_ENV_KEYS = {
   SERVICE_NAME: 'SERVICE_NAME',
   NODE_ENV: 'NODE_ENV',
   LOG_LEVEL: 'LOG_LEVEL',
   POSTGRES_USER: 'POSTGRES_USER',
   POSTGRES_PASSWORD: 'POSTGRES_PASSWORD',
   POSTGRES_DB: 'POSTGRES_DB',
   POSTGRES_PORT: 'POSTGRES_PORT',
   DATABASE_URL: 'DATABASE_URL',
   RABBIT_MQ_URI: 'RABBIT_MQ_URI',
   RABBIT_MQ_MEDIA_SERVICE_QUEUE: 'RABBIT_MQ_MEDIA_SERVICE_QUEUE',
   CLOUDINARY_CLOUD_NAME: 'CLOUDINARY_CLOUD_NAME',
   CLOUDINARY_API_KEY: 'CLOUDINARY_API_KEY',
   CLOUDINARY_API_SECRET: 'CLOUDINARY_API_SECRET',
   R2_ACCOUNT_ID: 'R2_ACCOUNT_ID',
   R2_ACCESS_KEY_ID: 'R2_ACCESS_KEY_ID',
   R2_SECRET_ACCESS_KEY: 'R2_SECRET_ACCESS_KEY',
   R2_BUCKET_NAME: 'R2_BUCKET_NAME',
   R2_ENDPOINT: 'R2_ENDPOINT',
   R2_PUBLIC_URL: 'R2_PUBLIC_URL',
   GRPC_PORT: 'GRPC_PORT',
   GRPC_URL: 'GRPC_URL',
} as const;

export type MediaEnvKey = (typeof MEDIA_ENV_KEYS)[keyof typeof MEDIA_ENV_KEYS];

export type MediaEnvConfig = z.infer<typeof mediaEnvSchema>;

export function validateMediaEnv(config: Record<string, unknown>): MediaEnvConfig {
   const parsed = mediaEnvSchema.safeParse(config);
   if (!parsed.success) {
      const formattedErrors = parsed.error.issues
         .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
         .join('\n');
      throw new Error(`Media environment validation error:\n${formattedErrors}`);
   }
   return parsed.data;
}
