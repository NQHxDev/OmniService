import * as fs from 'fs';
import * as path from 'path';

export const PRODUCT_GRPC_DOMAIN = 'product';

export const PROTO_VERSIONS = {
   V1: 'v1',
   V2: 'v2',
} as const;

export type ProtoVersion = (typeof PROTO_VERSIONS)[keyof typeof PROTO_VERSIONS];
export const DEFAULT_PROTO_VERSION: ProtoVersion = PROTO_VERSIONS.V1;

/**
 * Builds standard gRPC package name: <domain>.<version> (e.g. product.v1)
 */
export function buildGrpcPackageName(domain: string, version: ProtoVersion): string {
   return `${domain}.${version}`;
}

// Version 1 Constants (Active & Default)
export const PRODUCT_V1_GRPC_PACKAGE_NAME = buildGrpcPackageName(PRODUCT_GRPC_DOMAIN, PROTO_VERSIONS.V1);
export const PRODUCT_V1_GRPC_SERVICE_NAME = 'ProductService';
export const PRODUCT_V1_FULL_SERVICE_NAME = `${PRODUCT_V1_GRPC_PACKAGE_NAME}.${PRODUCT_V1_GRPC_SERVICE_NAME}`;
export const PRODUCT_V1_GRPC_CLIENT = 'PRODUCT_V1_GRPC_CLIENT';

export const PRODUCT_V1_GRPC_METHODS = {
   GET_PRODUCT_BY_ID: 'GetProductById',
   GET_PRODUCTS_BY_IDS: 'GetProductsByIds',
   LIST_PRODUCTS: 'ListProducts',
   CREATE_PRODUCT: 'CreateProduct',
   UPDATE_PRODUCT: 'UpdateProduct',
   MODERATE_PRODUCT: 'ModerateProduct',
   UPDATE_PRODUCT_STATUS: 'UpdateProductStatus',
   CHECK_AND_RESERVE_STOCK: 'CheckAndReserveStock',
   RELEASE_STOCK: 'ReleaseStock',
   ADJUST_STOCK: 'AdjustStock',
   LIST_WHO_CATEGORIES: 'ListWhoCategories',
} as const;

export type ProductV1GrpcMethod = (typeof PRODUCT_V1_GRPC_METHODS)[keyof typeof PRODUCT_V1_GRPC_METHODS];

/**
 * Returns the resolved file path to product.proto for the specified version (defaults to v1),
 * supporting runtime dist, local development, and fallback paths.
 */
export function getProductProtoPath(version: ProtoVersion = DEFAULT_PROTO_VERSION): string {
   const filename = 'product.proto';
   const candidates = [
      path.resolve(__dirname, `../proto/${version}/${filename}`),
      path.resolve(__dirname, `../../proto/${version}/${filename}`),
      path.resolve(process.cwd(), `libs/contracts/product/src/proto/${version}/${filename}`),
      path.resolve(process.cwd(), `dist/libs/contracts/product/proto/${version}/${filename}`),
   ];

   for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
         return candidate;
      }
   }

   return candidates[0];
}

/**
 * Proto loader options interface matching @grpc/proto-loader configuration
 */
export interface ProductProtoLoaderOptions {
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

/**
 * Returns the resolved directory path to the proto folder for the specified version (defaults to v1),
 * supporting both runtime dist and source locations for loader.includeDirs.
 */
export function getProductProtoDir(version: ProtoVersion = DEFAULT_PROTO_VERSION): string {
   const protoPath = getProductProtoPath(version);
   return path.dirname(protoPath);
}

/**
 * Returns standard proto loader options configured with includeDirs for modular proto resolution.
 */
export function getProductProtoLoaderOptions(version: ProtoVersion = DEFAULT_PROTO_VERSION): ProductProtoLoaderOptions {
   return {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
      includeDirs: [getProductProtoDir(version)],
   };
}
