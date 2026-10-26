import * as fs from 'fs';
import * as path from 'path';

export const SUPPLIER_GRPC_DOMAIN = 'supplier';

export const PROTO_VERSIONS = {
   V1: 'v1',
   V2: 'v2',
} as const;

export type ProtoVersion = (typeof PROTO_VERSIONS)[keyof typeof PROTO_VERSIONS];
export const DEFAULT_PROTO_VERSION: ProtoVersion = PROTO_VERSIONS.V1;

/**
 * Builds standard gRPC package name: <domain>.<version> (e.g. supplier.v1)
 */
export function buildGrpcPackageName(domain: string, version: ProtoVersion): string {
   return `${domain}.${version}`;
}

// Version 1 Constants (Active & Default)
export const SUPPLIER_V1_GRPC_PACKAGE_NAME = buildGrpcPackageName(SUPPLIER_GRPC_DOMAIN, PROTO_VERSIONS.V1);
export const SUPPLIER_V1_GRPC_SERVICE_NAME = 'SupplierService';
export const SUPPLIER_V1_FULL_SERVICE_NAME = `${SUPPLIER_V1_GRPC_PACKAGE_NAME}.${SUPPLIER_V1_GRPC_SERVICE_NAME}`;
export const SUPPLIER_V1_GRPC_CLIENT = 'SUPPLIER_V1_GRPC_CLIENT';

export const SUPPLIER_V1_GRPC_METHODS = {
   GET_SUPPLIER_BY_ID: 'GetSupplierById',
   GET_SUPPLIERS_BY_IDS: 'GetSuppliersByIds',
   LIST_SUPPLIERS: 'ListSuppliers',
   REGISTER_SUPPLIER: 'RegisterSupplier',
   GET_MY_SUPPLIER: 'GetMySupplier',
   UPDATE_SUPPLIER: 'UpdateSupplier',
   VERIFY_SUPPLIER: 'VerifySupplier',
   UPDATE_SUPPLIER_STATUS: 'UpdateSupplierStatus',
} as const;

export type SupplierV1GrpcMethod = (typeof SUPPLIER_V1_GRPC_METHODS)[keyof typeof SUPPLIER_V1_GRPC_METHODS];

/**
 * Returns the resolved file path to supplier.proto for the specified version (defaults to v1),
 * supporting runtime dist, local development, and fallback paths.
 */
export function getSupplierProtoPath(version: ProtoVersion = DEFAULT_PROTO_VERSION): string {
   const filename = 'supplier.proto';
   const candidates = [
      path.resolve(__dirname, `../proto/${version}/${filename}`),
      path.resolve(__dirname, `../../proto/${version}/${filename}`),
      path.resolve(process.cwd(), `libs/contracts/supplier/src/proto/${version}/${filename}`),
      path.resolve(process.cwd(), `dist/libs/contracts/supplier/proto/${version}/${filename}`),
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
export interface SupplierProtoLoaderOptions {
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
export function getSupplierProtoDir(version: ProtoVersion = DEFAULT_PROTO_VERSION): string {
   const protoPath = getSupplierProtoPath(version);
   return path.dirname(protoPath);
}

/**
 * Returns standard proto loader options configured with includeDirs for modular proto resolution.
 */
export function getSupplierProtoLoaderOptions(
   version: ProtoVersion = DEFAULT_PROTO_VERSION,
): SupplierProtoLoaderOptions {
   return {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
      includeDirs: [getSupplierProtoDir(version)],
   };
}
