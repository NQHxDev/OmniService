import * as fs from 'fs';
import * as path from 'path';

export const ORDER_GRPC_DOMAIN = 'order';

export const PROTO_VERSIONS = {
   V1: 'v1',
   V2: 'v2',
} as const;

export type ProtoVersion = (typeof PROTO_VERSIONS)[keyof typeof PROTO_VERSIONS];
export const DEFAULT_PROTO_VERSION: ProtoVersion = PROTO_VERSIONS.V1;

/**
 * Builds standard gRPC package name: <domain>.<version> (e.g. order.v1)
 */
export function buildGrpcPackageName(domain: string, version: ProtoVersion): string {
   return `${domain}.${version}`;
}

// Version 1 Constants (Active & Default)
export const ORDER_V1_GRPC_PACKAGE_NAME = buildGrpcPackageName(ORDER_GRPC_DOMAIN, PROTO_VERSIONS.V1);
export const ORDER_V1_GRPC_SERVICE_NAME = 'OrderService';
export const ORDER_V1_FULL_SERVICE_NAME = `${ORDER_V1_GRPC_PACKAGE_NAME}.${ORDER_V1_GRPC_SERVICE_NAME}`;
export const ORDER_V1_GRPC_CLIENT = 'ORDER_V1_GRPC_CLIENT';

export const ORDER_V1_GRPC_METHODS = {
   CREATE_ORDER: 'CreateOrder',
   GET_ORDER_BY_ID: 'GetOrderById',
   GET_ORDERS_BY_USER_ID: 'GetOrdersByUserId',
   CANCEL_ORDER: 'CancelOrder',
   UPDATE_ORDER_STATUS: 'UpdateOrderStatus',
} as const;

export type OrderV1GrpcMethod = (typeof ORDER_V1_GRPC_METHODS)[keyof typeof ORDER_V1_GRPC_METHODS];

/**
 * Returns the resolved file path to order.proto for the specified version (defaults to v1).
 */
export function getOrderProtoPath(version: ProtoVersion = DEFAULT_PROTO_VERSION): string {
   const filename = 'order.proto';
   const candidates = [
      path.resolve(__dirname, `../proto/${version}/${filename}`),
      path.resolve(__dirname, `../../proto/${version}/${filename}`),
      path.resolve(process.cwd(), `libs/contracts/order/src/proto/${version}/${filename}`),
      path.resolve(process.cwd(), `dist/libs/contracts/order/proto/${version}/${filename}`),
   ];

   for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
         return candidate;
      }
   }

   return candidates[0];
}

export interface OrderProtoLoaderOptions {
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

export function getOrderProtoDir(version: ProtoVersion = DEFAULT_PROTO_VERSION): string {
   const protoPath = getOrderProtoPath(version);
   return path.dirname(protoPath);
}

export function getOrderProtoLoaderOptions(version: ProtoVersion = DEFAULT_PROTO_VERSION): OrderProtoLoaderOptions {
   return {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
      includeDirs: [getOrderProtoDir(version)],
   };
}
