import * as fs from 'fs';
import * as path from 'path';

export const MEDIA_GRPC_DOMAIN = 'media';

export const PROTO_VERSIONS = {
   V1: 'v1',
   V2: 'v2',
} as const;

export type ProtoVersion = (typeof PROTO_VERSIONS)[keyof typeof PROTO_VERSIONS];
export const DEFAULT_PROTO_VERSION: ProtoVersion = PROTO_VERSIONS.V1;

/**
 * Builds standard gRPC package name: <domain>.<version> (e.g. media.v1)
 */
export function buildGrpcPackageName(domain: string, version: ProtoVersion): string {
   return `${domain}.${version}`;
}

// Version 1 Constants (Active & Default)
export const MEDIA_V1_GRPC_PACKAGE_NAME = buildGrpcPackageName(MEDIA_GRPC_DOMAIN, PROTO_VERSIONS.V1);
export const MEDIA_V1_GRPC_SERVICE_NAME = 'MediaService';
export const MEDIA_V1_FULL_SERVICE_NAME = `${MEDIA_V1_GRPC_PACKAGE_NAME}.${MEDIA_V1_GRPC_SERVICE_NAME}`;
export const MEDIA_V1_GRPC_CLIENT = 'MEDIA_V1_GRPC_CLIENT';

export const MEDIA_V1_GRPC_METHODS = {
   GET_UPLOAD_URL: 'GetUploadUrl',
   UPLOAD_FILE: 'UploadFile',
   CONFIRM_UPLOAD: 'ConfirmUpload',
   GET_MEDIA_BY_ID: 'GetMediaById',
   DELETE_MEDIA: 'DeleteMedia',
   INITIATE_MULTIPART_UPLOAD: 'InitiateMultipartUpload',
   COMPLETE_MULTIPART_UPLOAD: 'CompleteMultipartUpload',
} as const;

export type MediaV1GrpcMethod = (typeof MEDIA_V1_GRPC_METHODS)[keyof typeof MEDIA_V1_GRPC_METHODS];

/**
 * Returns the resolved file path to media.proto for the specified version (defaults to v1),
 * supporting runtime dist, local development, and fallback paths.
 */
export function getMediaProtoPath(version: ProtoVersion = DEFAULT_PROTO_VERSION): string {
   const filename = 'media.proto';
   const candidates = [
      path.resolve(__dirname, `../proto/${version}/${filename}`),
      path.resolve(__dirname, `../../proto/${version}/${filename}`),
      path.resolve(process.cwd(), `libs/contracts/media/src/proto/${version}/${filename}`),
      path.resolve(process.cwd(), `dist/libs/contracts/media/proto/${version}/${filename}`),
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
export interface MediaProtoLoaderOptions {
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
export function getMediaProtoDir(version: ProtoVersion = DEFAULT_PROTO_VERSION): string {
   const protoPath = getMediaProtoPath(version);
   return path.dirname(protoPath);
}

/**
 * Returns standard proto loader options configured with includeDirs for modular proto resolution.
 */
export function getMediaProtoLoaderOptions(version: ProtoVersion = DEFAULT_PROTO_VERSION): MediaProtoLoaderOptions {
   return {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
      includeDirs: [getMediaProtoDir(version)],
   };
}
