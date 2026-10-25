import {
   buildGrpcPackageName,
   DEFAULT_PROTO_VERSION,
   getPostProtoDir,
   getPostProtoLoaderOptions,
   getPostProtoPath,
   POST_GRPC_DOMAIN,
   POST_V1_FULL_SERVICE_NAME,
   POST_V1_GRPC_CLIENT,
   POST_V1_GRPC_METHODS,
   POST_V1_GRPC_PACKAGE_NAME,
   POST_V1_GRPC_SERVICE_NAME,
   PROTO_VERSIONS,
} from '@contracts/post/constants/grpc.constant';

describe('Post gRPC Constants', () => {
   describe('buildGrpcPackageName', () => {
      it('should format domain and version into dot notation', () => {
         expect(buildGrpcPackageName('post', 'v1')).toBe('post.v1');
         expect(buildGrpcPackageName('post', 'v2')).toBe('post.v2');
      });
   });

   describe('Version 1 Constants', () => {
      it('should define domain as post', () => {
         expect(POST_GRPC_DOMAIN).toBe('post');
      });

      it('should define default version as v1', () => {
         expect(DEFAULT_PROTO_VERSION).toBe(PROTO_VERSIONS.V1);
      });

      it('should match dynamic package naming standard', () => {
         expect(POST_V1_GRPC_PACKAGE_NAME).toBe('post.v1');
      });

      it('should define service and full service name accurately', () => {
         expect(POST_V1_GRPC_SERVICE_NAME).toBe('PostService');
         expect(POST_V1_FULL_SERVICE_NAME).toBe('post.v1.PostService');
         expect(POST_V1_GRPC_CLIENT).toBe('POST_V1_GRPC_CLIENT');
      });

      it('should export all post RPC method names', () => {
         expect(POST_V1_GRPC_METHODS.GET_FEED).toBe('GetFeed');
         expect(POST_V1_GRPC_METHODS.GET_POST_BY_ID).toBe('GetPostById');
         expect(POST_V1_GRPC_METHODS.GET_INGREDIENTS_BY_POST_ID).toBe('GetIngredientsByPostId');
      });
   });

   describe('Proto Path Resolvers', () => {
      it('should resolve proto file path ending with post.proto', () => {
         const protoPath = getPostProtoPath();
         expect(protoPath).toMatch(/post\.proto$/);
      });

      it('should resolve proto dir path', () => {
         const protoDir = getPostProtoDir();
         expect(protoDir).toContain('proto');
      });

      it('should configure proto loader options with includeDirs', () => {
         const options = getPostProtoLoaderOptions();
         expect(options.keepCase).toBe(true);
         expect(options.includeDirs).toBeDefined();
         expect(options.includeDirs?.length).toBeGreaterThan(0);
      });
   });
});
