import * as fs from 'fs';
import * as path from 'path';

export const POST_GRPC_DOMAIN = 'post';

export const PROTO_VERSIONS = {
   V1: 'v1',
   V2: 'v2',
} as const;

export type ProtoVersion = (typeof PROTO_VERSIONS)[keyof typeof PROTO_VERSIONS];
export const DEFAULT_PROTO_VERSION: ProtoVersion = PROTO_VERSIONS.V1;

/**
 * Builds standard gRPC package name: <domain>.<version> (e.g. post.v1)
 */
export function buildGrpcPackageName(domain: string, version: ProtoVersion): string {
   return `${domain}.${version}`;
}

// Version 1 Constants (Active & Default)
export const POST_V1_GRPC_PACKAGE_NAME = buildGrpcPackageName(POST_GRPC_DOMAIN, PROTO_VERSIONS.V1);
export const POST_V1_GRPC_SERVICE_NAME = 'PostService';
export const POST_V1_FULL_SERVICE_NAME = `${POST_V1_GRPC_PACKAGE_NAME}.${POST_V1_GRPC_SERVICE_NAME}`;
export const POST_V1_GRPC_CLIENT = 'POST_V1_GRPC_CLIENT';

export const POST_V1_GRPC_METHODS = {
   GET_FEED: 'GetFeed',
   GET_POST_BY_ID: 'GetPostById',
   GET_INGREDIENTS_BY_POST_ID: 'GetIngredientsByPostId',
} as const;

export type PostV1GrpcMethod = (typeof POST_V1_GRPC_METHODS)[keyof typeof POST_V1_GRPC_METHODS];

/**
 * Returns the resolved file path to post.proto for the specified version (defaults to v1),
 * supporting runtime dist, local development, and fallback paths.
 */
export function getPostProtoPath(version: ProtoVersion = DEFAULT_PROTO_VERSION): string {
   const filename = 'post.proto';
   const candidates = [
      path.resolve(__dirname, `../proto/${version}/${filename}`),
      path.resolve(__dirname, `../../proto/${version}/${filename}`),
      path.resolve(process.cwd(), `libs/contracts/post/src/proto/${version}/${filename}`),
      path.resolve(process.cwd(), `dist/libs/contracts/post/proto/${version}/${filename}`),
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
export interface PostProtoLoaderOptions {
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
export function getPostProtoDir(version: ProtoVersion = DEFAULT_PROTO_VERSION): string {
   const protoPath = getPostProtoPath(version);
   return path.dirname(protoPath);
}

/**
 * Returns standard proto loader options configured with includeDirs for modular proto resolution.
 */
export function getPostProtoLoaderOptions(version: ProtoVersion = DEFAULT_PROTO_VERSION): PostProtoLoaderOptions {
   return {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
      includeDirs: [getPostProtoDir(version)],
   };
}
