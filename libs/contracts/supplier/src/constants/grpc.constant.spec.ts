import {
   buildGrpcPackageName,
   DEFAULT_PROTO_VERSION,
   PROTO_VERSIONS,
   SUPPLIER_GRPC_DOMAIN,
   SUPPLIER_V1_FULL_SERVICE_NAME,
   SUPPLIER_V1_GRPC_CLIENT,
   SUPPLIER_V1_GRPC_METHODS,
   SUPPLIER_V1_GRPC_PACKAGE_NAME,
   SUPPLIER_V1_GRPC_SERVICE_NAME,
   getSupplierProtoDir,
   getSupplierProtoLoaderOptions,
   getSupplierProtoPath,
} from '@contracts/supplier/constants/grpc.constant';

describe('Supplier gRPC Constants', () => {
   describe('buildGrpcPackageName', () => {
      it('should format domain and version into dot notation', () => {
         expect(buildGrpcPackageName('supplier', 'v1')).toBe('supplier.v1');
         expect(buildGrpcPackageName('supplier', 'v2')).toBe('supplier.v2');
      });
   });

   describe('Version 1 Constants', () => {
      it('should define domain as supplier', () => {
         expect(SUPPLIER_GRPC_DOMAIN).toBe('supplier');
      });

      it('should define default version as v1', () => {
         expect(DEFAULT_PROTO_VERSION).toBe(PROTO_VERSIONS.V1);
      });

      it('should match dynamic package naming standard', () => {
         expect(SUPPLIER_V1_GRPC_PACKAGE_NAME).toBe('supplier.v1');
      });

      it('should define service and full service name accurately', () => {
         expect(SUPPLIER_V1_GRPC_SERVICE_NAME).toBe('SupplierService');
         expect(SUPPLIER_V1_FULL_SERVICE_NAME).toBe('supplier.v1.SupplierService');
         expect(SUPPLIER_V1_GRPC_CLIENT).toBe('SUPPLIER_V1_GRPC_CLIENT');
      });

      it('should export all supplier RPC method names', () => {
         expect(SUPPLIER_V1_GRPC_METHODS.GET_SUPPLIER_BY_ID).toBe('GetSupplierById');
         expect(SUPPLIER_V1_GRPC_METHODS.GET_SUPPLIERS_BY_IDS).toBe('GetSuppliersByIds');
         expect(SUPPLIER_V1_GRPC_METHODS.LIST_SUPPLIERS).toBe('ListSuppliers');
         expect(SUPPLIER_V1_GRPC_METHODS.REGISTER_SUPPLIER).toBe('RegisterSupplier');
         expect(SUPPLIER_V1_GRPC_METHODS.GET_MY_SUPPLIER).toBe('GetMySupplier');
         expect(SUPPLIER_V1_GRPC_METHODS.UPDATE_SUPPLIER).toBe('UpdateSupplier');
         expect(SUPPLIER_V1_GRPC_METHODS.VERIFY_SUPPLIER).toBe('VerifySupplier');
         expect(SUPPLIER_V1_GRPC_METHODS.UPDATE_SUPPLIER_STATUS).toBe('UpdateSupplierStatus');
      });
   });

   describe('Proto Path Resolvers', () => {
      it('should resolve proto file path ending with supplier.proto', () => {
         const protoPath = getSupplierProtoPath();
         expect(protoPath).toMatch(/supplier\.proto$/);
      });

      it('should resolve proto dir path', () => {
         const protoDir = getSupplierProtoDir();
         expect(protoDir).toContain('proto');
      });

      it('should configure proto loader options with includeDirs', () => {
         const options = getSupplierProtoLoaderOptions();
         expect(options.keepCase).toBe(true);
         expect(options.includeDirs).toBeDefined();
         expect(options.includeDirs?.length).toBeGreaterThan(0);
      });
   });
});
