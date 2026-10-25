import * as fs from 'fs';
import * as path from 'path';

export const PAYMENT_GRPC_DOMAIN = 'payment';

export const PROTO_VERSIONS = {
   V1: 'v1',
   V2: 'v2',
} as const;

export type ProtoVersion = (typeof PROTO_VERSIONS)[keyof typeof PROTO_VERSIONS];
export const DEFAULT_PROTO_VERSION: ProtoVersion = PROTO_VERSIONS.V1;

/**
 * Builds standard gRPC package name: <domain>.<version> (e.g. payment.v1)
 */
export function buildGrpcPackageName(domain: string, version: ProtoVersion): string {
   return `${domain}.${version}`;
}

// Version 1 Constants (Active & Default)
export const PAYMENT_V1_GRPC_PACKAGE_NAME = buildGrpcPackageName(PAYMENT_GRPC_DOMAIN, PROTO_VERSIONS.V1);
export const PAYMENT_V1_GRPC_SERVICE_NAME = 'PaymentService';
export const PAYMENT_V1_FULL_SERVICE_NAME = `${PAYMENT_V1_GRPC_PACKAGE_NAME}.${PAYMENT_V1_GRPC_SERVICE_NAME}`;
export const PAYMENT_V1_GRPC_CLIENT = 'PAYMENT_V1_GRPC_CLIENT';

export const PAYMENT_V1_GRPC_METHODS = {
   INITIATE_PAYMENT: 'InitiatePayment',
   GET_PAYMENT_BY_ID: 'GetPaymentById',
   GET_PAYMENT_BY_ORDER_ID: 'GetPaymentByOrderId',
   PROCESS_WEBHOOK: 'ProcessWebhook',
   REFUND_PAYMENT: 'RefundPayment',
} as const;

export type PaymentV1GrpcMethod = (typeof PAYMENT_V1_GRPC_METHODS)[keyof typeof PAYMENT_V1_GRPC_METHODS];

/**
 * Returns the resolved file path to payment.proto for the specified version (defaults to v1).
 */
export function getPaymentProtoPath(version: ProtoVersion = DEFAULT_PROTO_VERSION): string {
   const filename = 'payment.proto';
   const candidates = [
      path.resolve(__dirname, `../proto/${version}/${filename}`),
      path.resolve(__dirname, `../../proto/${version}/${filename}`),
      path.resolve(process.cwd(), `libs/contracts/payment/src/proto/${version}/${filename}`),
      path.resolve(process.cwd(), `dist/libs/contracts/payment/proto/${version}/${filename}`),
   ];

   for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
         return candidate;
      }
   }

   return candidates[0];
}

export interface PaymentProtoLoaderOptions {
   keepCase?: boolean;
   alternateCommentMode?: boolean;
   longs?: (value: unknown) => unknown;
   enums?: (value: unknown) => unknown;
   bytes?: (value: unknown) => unknown;
   defaults?: boolean;
   arrays?: boolean;
   objects?: boolean;
   oneofs?: boolean;
   json?: boolean;
   includeDirs?: string[];
}

export function getPaymentProtoDir(version: ProtoVersion = DEFAULT_PROTO_VERSION): string {
   const protoPath = getPaymentProtoPath(version);
   return path.dirname(protoPath);
}

export function getPaymentProtoLoaderOptions(version: ProtoVersion = DEFAULT_PROTO_VERSION): PaymentProtoLoaderOptions {
   return {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
      includeDirs: [getPaymentProtoDir(version)],
   };
}
