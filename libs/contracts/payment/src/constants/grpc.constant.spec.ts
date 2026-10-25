import * as fs from 'fs';
import {
   buildGrpcPackageName,
   DEFAULT_PROTO_VERSION,
   getPaymentProtoDir,
   getPaymentProtoLoaderOptions,
   getPaymentProtoPath,
   PAYMENT_GRPC_DOMAIN,
   PAYMENT_V1_FULL_SERVICE_NAME,
   PAYMENT_V1_GRPC_CLIENT,
   PAYMENT_V1_GRPC_METHODS,
   PAYMENT_V1_GRPC_PACKAGE_NAME,
   PAYMENT_V1_GRPC_SERVICE_NAME,
   PROTO_VERSIONS,
} from '@contracts/payment/constants/grpc.constant';

describe('Payment gRPC Constants and Proto Resolution', () => {
   it('should define domain, version, and dynamic package name correctly', () => {
      expect(PAYMENT_GRPC_DOMAIN).toBe('payment');
      expect(PROTO_VERSIONS.V1).toBe('v1');
      expect(DEFAULT_PROTO_VERSION).toBe('v1');
      expect(buildGrpcPackageName(PAYMENT_GRPC_DOMAIN, PROTO_VERSIONS.V1)).toBe('payment.v1');
      expect(PAYMENT_V1_GRPC_PACKAGE_NAME).toBe('payment.v1');
      expect(PAYMENT_V1_GRPC_SERVICE_NAME).toBe('PaymentService');
      expect(PAYMENT_V1_FULL_SERVICE_NAME).toBe('payment.v1.PaymentService');
      expect(PAYMENT_V1_GRPC_CLIENT).toBe('PAYMENT_V1_GRPC_CLIENT');
   });

   it('should define all RPC methods in PAYMENT_V1_GRPC_METHODS', () => {
      expect(PAYMENT_V1_GRPC_METHODS.INITIATE_PAYMENT).toBe('InitiatePayment');
      expect(PAYMENT_V1_GRPC_METHODS.GET_PAYMENT_BY_ID).toBe('GetPaymentById');
      expect(PAYMENT_V1_GRPC_METHODS.GET_PAYMENT_BY_ORDER_ID).toBe('GetPaymentByOrderId');
      expect(PAYMENT_V1_GRPC_METHODS.PROCESS_WEBHOOK).toBe('ProcessWebhook');
      expect(PAYMENT_V1_GRPC_METHODS.REFUND_PAYMENT).toBe('RefundPayment');
   });

   it('should resolve proto path and ensure file exists on disk', () => {
      const protoPath = getPaymentProtoPath();
      expect(fs.existsSync(protoPath)).toBe(true);
      expect(protoPath).toMatch(/payment\.proto$/);
   });

   it('should configure proto loader options with correct includeDirs', () => {
      const options = getPaymentProtoLoaderOptions();
      expect(options.keepCase).toBe(true);
      expect(options.defaults).toBe(true);
      expect(options.oneofs).toBe(true);
      expect(options.includeDirs).toBeDefined();
      expect(options.includeDirs?.[0]).toBe(getPaymentProtoDir());
      expect(fs.existsSync(options.includeDirs![0])).toBe(true);
   });
});
