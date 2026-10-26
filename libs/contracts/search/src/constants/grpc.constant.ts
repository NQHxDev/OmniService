import * as fs from 'fs';
import * as path from 'path';

export const SEARCH_GRPC_DOMAIN = 'search';

export const PROTO_VERSIONS = {
   V1: 'v1',
   V2: 'v2',
} as const;

export type ProtoVersion = (typeof PROTO_VERSIONS)[keyof typeof PROTO_VERSIONS];
export const DEFAULT_PROTO_VERSION: ProtoVersion = PROTO_VERSIONS.V1;

/**
 * Builds standard gRPC package name: <domain>.<version> (e.g. search.v1)
 */
export function buildGrpcPackageName(domain: string, version: ProtoVersion): string {
   return `${domain}.${version}`;
}

// Version 1 Constants (Active & Default)
export const SEARCH_V1_GRPC_PACKAGE_NAME = buildGrpcPackageName(SEARCH_GRPC_DOMAIN, PROTO_VERSIONS.V1);
export const SEARCH_V1_GRPC_SERVICE_NAME = 'SearchService';
export const SEARCH_V1_FULL_SERVICE_NAME = `${SEARCH_V1_GRPC_PACKAGE_NAME}.${SEARCH_V1_GRPC_SERVICE_NAME}`;
export const SEARCH_V1_GRPC_CLIENT = 'SEARCH_V1_GRPC_CLIENT';

export const SEARCH_V1_GRPC_METHODS = {
   SEARCH_USERS: 'SearchUsers',
   SEARCH_INGREDIENTS: 'SearchIngredients',
   GLOBAL_SEARCH: 'GlobalSearch',
   GET_POST_FEED: 'GetPostFeed',
   GET_POST_DETAIL: 'GetPostDetail',
} as const;

export type SearchV1GrpcMethod = (typeof SEARCH_V1_GRPC_METHODS)[keyof typeof SEARCH_V1_GRPC_METHODS];

/**
 * Returns the resolved file path to search.proto for the specified version (defaults to v1),
 * supporting runtime dist, local development, and fallback paths.
 */
export function getSearchProtoPath(version: ProtoVersion = DEFAULT_PROTO_VERSION): string {
   const filename = 'search.proto';
   const candidates = [
      path.resolve(__dirname, `../proto/${version}/${filename}`),
      path.resolve(__dirname, `../../proto/${version}/${filename}`),
      path.resolve(process.cwd(), `libs/contracts/search/src/proto/${version}/${filename}`),
      path.resolve(process.cwd(), `dist/libs/contracts/search/proto/${version}/${filename}`),
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
export interface SearchProtoLoaderOptions {
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
export function getSearchProtoDir(version: ProtoVersion = DEFAULT_PROTO_VERSION): string {
   const protoPath = getSearchProtoPath(version);
   return path.dirname(protoPath);
}

/**
 * Returns standard proto loader options configured with includeDirs for modular proto resolution.
 */
export function getSearchProtoLoaderOptions(version: ProtoVersion = DEFAULT_PROTO_VERSION): SearchProtoLoaderOptions {
   return {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
      includeDirs: [getSearchProtoDir(version)],
   };
}
