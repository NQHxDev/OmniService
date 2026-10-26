import { z } from 'zod';
import { sharedEnvSchema } from '@common';

export const PAYMENT_ENV_KEYS = {
   PORT: 'PORT',
   GRPC_PORT: 'GRPC_PORT',
   DATABASE_URL: 'DATABASE_URL',
   POSTGRES_PORT: 'POSTGRES_PORT',
   ORDER_GRPC_URL: 'ORDER_GRPC_URL',
   VNPAY_TMN_CODE: 'VNPAY_TMN_CODE',
   VNPAY_HASH_SECRET: 'VNPAY_HASH_SECRET',
   VNPAY_URL: 'VNPAY_URL',
   VNPAY_RETURN_URL: 'VNPAY_RETURN_URL',
   MOMO_PARTNER_CODE: 'MOMO_PARTNER_CODE',
   MOMO_ACCESS_KEY: 'MOMO_ACCESS_KEY',
   MOMO_SECRET_KEY: 'MOMO_SECRET_KEY',
   MOMO_ENDPOINT: 'MOMO_ENDPOINT',
   MOMO_RETURN_URL: 'MOMO_RETURN_URL',
   MOMO_NOTIFY_URL: 'MOMO_NOTIFY_URL',
} as const;

export type PaymentEnvKey = (typeof PAYMENT_ENV_KEYS)[keyof typeof PAYMENT_ENV_KEYS];

export const paymentEnvSchema = sharedEnvSchema.extend({
   SERVICE_NAME: z.string().default('payment-service'),
   POSTGRES_USER: z.string().default('postgres'),
   POSTGRES_PASSWORD: z.string().default('postgres'),
   POSTGRES_DB: z.string().default('omni_service_payment'),
   POSTGRES_PORT: z.coerce.number().int().positive().default(5446),
   PGBOUNCER_PORT: z.coerce.number().int().positive().default(6432),
   DATABASE_URL: z
      .string()
      .default(
         'postgresql://postgres:postgres@localhost:6432/omni_service_payment?connection_limit=5&pool_timeout=10&pgbouncer=true',
      ),
   DIRECT_URL: z.string().optional(),
   PORT: z.coerce.number().int().positive().default(3010),
   GRPC_PORT: z.coerce.number().int().positive().default(50058),
   ORDER_GRPC_URL: z.string().default('localhost:50057'),

   // VNPay Configuration
   VNPAY_TMN_CODE: z.string().default('DEMOTMNCODE'),
   VNPAY_HASH_SECRET: z.string().default('DEMOSECRETKEY9876543210ABCDEF'),
   VNPAY_URL: z.string().default('https://sandbox.vnpayment.vn/paymentv2/vpcpay.html'),
   VNPAY_RETURN_URL: z.string().default('http://localhost:3000/api/v1/payments/webhooks/vnpay'),

   // MoMo Configuration
   MOMO_PARTNER_CODE: z.string().default('MOMOBKUN20180529'),
   MOMO_ACCESS_KEY: z.string().default('klm05TvNBzhg7h7j'),
   MOMO_SECRET_KEY: z.string().default('at67qH6mk8w5Y1nAyMoYKMWACiEi2bsa'),
   MOMO_ENDPOINT: z.string().default('https://test-payment.momo.vn/v2/gateway/api/create'),
   MOMO_RETURN_URL: z.string().default('http://localhost:3000/api/v1/payments/webhooks/momo'),
   MOMO_NOTIFY_URL: z.string().default('http://localhost:3000/api/v1/payments/webhooks/momo'),
});

export type PaymentEnvConfig = z.infer<typeof paymentEnvSchema>;

export function validatePaymentEnv(config: Record<string, unknown>): PaymentEnvConfig {
   const parsed = paymentEnvSchema.safeParse(config);
   if (!parsed.success) {
      const formattedErrors = parsed.error.issues
         .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
         .join('\n');
      throw new Error(`Payment environment validation error:\n${formattedErrors}`);
   }
   return parsed.data;
}
