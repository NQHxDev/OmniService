import * as fs from 'fs';
import {
   buildGrpcPackageName,
   DEFAULT_PROTO_VERSION,
   getOrderProtoDir,
   getOrderProtoLoaderOptions,
   getOrderProtoPath,
   ORDER_GRPC_DOMAIN,
   ORDER_V1_FULL_SERVICE_NAME,
   ORDER_V1_GRPC_CLIENT,
   ORDER_V1_GRPC_METHODS,
   ORDER_V1_GRPC_PACKAGE_NAME,
   ORDER_V1_GRPC_SERVICE_NAME,
   PROTO_VERSIONS,
} from '@contracts/order/constants/grpc.constant';

describe('Order gRPC Constants and Proto Resolution', () => {
   it('should define domain, version, and dynamic package name correctly', () => {
      expect(ORDER_GRPC_DOMAIN).toBe('order');
      expect(PROTO_VERSIONS.V1).toBe('v1');
      expect(DEFAULT_PROTO_VERSION).toBe('v1');
      expect(buildGrpcPackageName(ORDER_GRPC_DOMAIN, PROTO_VERSIONS.V1)).toBe('order.v1');
      expect(ORDER_V1_GRPC_PACKAGE_NAME).toBe('order.v1');
      expect(ORDER_V1_GRPC_SERVICE_NAME).toBe('OrderService');
      expect(ORDER_V1_FULL_SERVICE_NAME).toBe('order.v1.OrderService');
      expect(ORDER_V1_GRPC_CLIENT).toBe('ORDER_V1_GRPC_CLIENT');
   });

   it('should define all RPC methods in ORDER_V1_GRPC_METHODS', () => {
      expect(ORDER_V1_GRPC_METHODS.CREATE_ORDER).toBe('CreateOrder');
      expect(ORDER_V1_GRPC_METHODS.GET_ORDER_BY_ID).toBe('GetOrderById');
      expect(ORDER_V1_GRPC_METHODS.GET_ORDERS_BY_USER_ID).toBe('GetOrdersByUserId');
      expect(ORDER_V1_GRPC_METHODS.CANCEL_ORDER).toBe('CancelOrder');
      expect(ORDER_V1_GRPC_METHODS.UPDATE_ORDER_STATUS).toBe('UpdateOrderStatus');
   });

   it('should resolve proto path and ensure file exists on disk', () => {
      const protoPath = getOrderProtoPath();
      expect(fs.existsSync(protoPath)).toBe(true);
      expect(protoPath).toMatch(/order\.proto$/);
   });

   it('should configure proto loader options with correct includeDirs', () => {
      const options = getOrderProtoLoaderOptions();
      expect(options.keepCase).toBe(true);
      expect(options.defaults).toBe(true);
      expect(options.oneofs).toBe(true);
      expect(options.includeDirs).toBeDefined();
      expect(options.includeDirs?.[0]).toBe(getOrderProtoDir());
      expect(fs.existsSync(options.includeDirs![0])).toBe(true);
   });
});
