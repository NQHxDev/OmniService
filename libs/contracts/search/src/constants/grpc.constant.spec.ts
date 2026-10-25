import * as fs from 'fs';
import {
   buildGrpcPackageName,
   DEFAULT_PROTO_VERSION,
   getSearchProtoDir,
   getSearchProtoLoaderOptions,
   getSearchProtoPath,
   PROTO_VERSIONS,
   SEARCH_GRPC_DOMAIN,
   SEARCH_V1_FULL_SERVICE_NAME,
   SEARCH_V1_GRPC_CLIENT,
   SEARCH_V1_GRPC_METHODS,
   SEARCH_V1_GRPC_PACKAGE_NAME,
   SEARCH_V1_GRPC_SERVICE_NAME,
} from './grpc.constant';

describe('Search gRPC Constants and Proto Resolution', () => {
   it('should define domain, version, and dynamic package name correctly', () => {
      expect(SEARCH_GRPC_DOMAIN).toBe('search');
      expect(PROTO_VERSIONS.V1).toBe('v1');
      expect(DEFAULT_PROTO_VERSION).toBe('v1');
      expect(buildGrpcPackageName(SEARCH_GRPC_DOMAIN, PROTO_VERSIONS.V1)).toBe('search.v1');
      expect(SEARCH_V1_GRPC_PACKAGE_NAME).toBe('search.v1');
      expect(SEARCH_V1_GRPC_SERVICE_NAME).toBe('SearchService');
      expect(SEARCH_V1_FULL_SERVICE_NAME).toBe('search.v1.SearchService');
      expect(SEARCH_V1_GRPC_CLIENT).toBe('SEARCH_V1_GRPC_CLIENT');
   });

   it('should define all RPC methods in SEARCH_V1_GRPC_METHODS', () => {
      expect(SEARCH_V1_GRPC_METHODS.SEARCH_USERS).toBe('SearchUsers');
      expect(SEARCH_V1_GRPC_METHODS.SEARCH_INGREDIENTS).toBe('SearchIngredients');
      expect(SEARCH_V1_GRPC_METHODS.GLOBAL_SEARCH).toBe('GlobalSearch');
      expect(SEARCH_V1_GRPC_METHODS.GET_POST_FEED).toBe('GetPostFeed');
      expect(SEARCH_V1_GRPC_METHODS.GET_POST_DETAIL).toBe('GetPostDetail');
   });

   it('should resolve proto path and ensure file exists on disk', () => {
      const protoPath = getSearchProtoPath();
      expect(fs.existsSync(protoPath)).toBe(true);
      expect(protoPath).toMatch(/search\.proto$/);
   });

   it('should configure proto loader options with correct includeDirs', () => {
      const options = getSearchProtoLoaderOptions();
      expect(options.keepCase).toBe(true);
      expect(options.defaults).toBe(true);
      expect(options.oneofs).toBe(true);
      expect(options.includeDirs).toBeDefined();
      expect(options.includeDirs?.[0]).toBe(getSearchProtoDir());
      expect(fs.existsSync(options.includeDirs![0])).toBe(true);
   });
});
