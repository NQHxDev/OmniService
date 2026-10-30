import * as fs from 'fs';
import * as path from 'path';

export const ANALYZE_GRPC_DOMAIN = 'analyze';

export const PROTO_VERSIONS = {
   V1: 'v1',
   V2: 'v2',
} as const;

export type ProtoVersion = (typeof PROTO_VERSIONS)[keyof typeof PROTO_VERSIONS];
export const DEFAULT_PROTO_VERSION: ProtoVersion = PROTO_VERSIONS.V1;

export function buildGrpcPackageName(domain: string, version: ProtoVersion): string {
   return `${domain}.${version}`;
}

export const ANALYZE_V1_GRPC_PACKAGE_NAME = buildGrpcPackageName(ANALYZE_GRPC_DOMAIN, PROTO_VERSIONS.V1);
export const ANALYZE_V1_GRPC_SERVICE_NAME = 'AnalyzeService';
export const ANALYZE_V1_FULL_SERVICE_NAME = `${ANALYZE_V1_GRPC_PACKAGE_NAME}.${ANALYZE_V1_GRPC_SERVICE_NAME}`;
export const ANALYZE_V1_GRPC_CLIENT = 'ANALYZE_V1_GRPC_CLIENT';

export const ANALYZE_V1_GRPC_METHODS = {
   GET_USER_INTERESTS: 'GetUserInterests',
   RECORD_WATCH_SESSION: 'RecordWatchSession',
} as const;

export type AnalyzeV1GrpcMethod = (typeof ANALYZE_V1_GRPC_METHODS)[keyof typeof ANALYZE_V1_GRPC_METHODS];

export function getAnalyzeProtoPath(version: ProtoVersion = DEFAULT_PROTO_VERSION): string {
   const filename = 'analyze.proto';
   const candidates = [
      path.resolve(__dirname, `../proto/${version}/${filename}`),
      path.resolve(__dirname, `../../proto/${version}/${filename}`),
      path.resolve(process.cwd(), `libs/contracts/analyze/src/proto/${version}/${filename}`),
      path.resolve(process.cwd(), `dist/libs/contracts/analyze/proto/${version}/${filename}`),
   ];

   for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
         return candidate;
      }
   }

   return candidates[0];
}

export interface AnalyzeProtoLoaderOptions {
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

export function getAnalyzeProtoDir(version: ProtoVersion = DEFAULT_PROTO_VERSION): string {
   const protoPath = getAnalyzeProtoPath(version);
   return path.dirname(protoPath);
}

export function getAnalyzeProtoLoaderOptions(version: ProtoVersion = DEFAULT_PROTO_VERSION): AnalyzeProtoLoaderOptions {
   return {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
      includeDirs: [getAnalyzeProtoDir(version)],
   };
}
