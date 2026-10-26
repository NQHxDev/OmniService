import { Test, TestingModule } from '@nestjs/testing';
import type { ClientGrpc } from '@nestjs/microservices';
import type { Metadata } from '@grpc/grpc-js';
import { of, throwError } from 'rxjs';
import { DEFAULT_ROLES, type JwtPayload } from '@common';
import {
   PAYMENT_V1_GRPC_CLIENT,
   type IPaymentV1GrpcService,
   type IRefundPaymentResponse,
   type RefundPaymentDto,
} from '@contracts/payment';
import { PaymentsService } from '@/modules/payments/payments.service';
import { OrdersService } from '@/modules/orders/orders.service';

describe('PaymentsService', () => {
   let service: PaymentsService;
   let mockPaymentGrpcService: jest.Mocked<IPaymentV1GrpcService>;

   beforeEach(async () => {
      mockPaymentGrpcService = {
         initiatePayment: jest.fn(),
         getPaymentById: jest.fn(),
         getPaymentByOrderId: jest.fn(),
         processWebhook: jest.fn(),
         refundPayment: jest.fn(),
      };

      const mockClientGrpc: jest.Mocked<ClientGrpc> = {
         getService: jest.fn().mockReturnValue(mockPaymentGrpcService),
         getClientByServiceName: jest.fn(),
      };

      const mockOrdersService = {
         getOrderById: jest.fn(),
      };

      const module: TestingModule = await Test.createTestingModule({
         providers: [
            PaymentsService,
            { provide: PAYMENT_V1_GRPC_CLIENT, useValue: mockClientGrpc },
            { provide: OrdersService, useValue: mockOrdersService },
         ],
      }).compile();

      service = module.get<PaymentsService>(PaymentsService);
      service.onModuleInit();
   });

   describe('refundPayment', () => {
      it('should inject user roles and identity into gRPC metadata and return refund response', async () => {
         const expectedResponse: IRefundPaymentResponse = {
            success: true,
            message: 'PAYMENT.REFUND_SUCCESS',
            refundId: 'ref-001',
         };

         let capturedMetadata: Metadata | undefined;
         mockPaymentGrpcService.refundPayment.mockImplementation((_req, metadata) => {
            capturedMetadata = metadata;
            return of(expectedResponse);
         });

         const dto: RefundPaymentDto = {
            transactionId: 'tx-12345',
            amount: 100000,
            reason: 'Damaged item on arrival',
         };

         const adminUser: JwtPayload = {
            sub: 'admin-uuid-001',
            email: 'admin@platform.vn',
            roles: [DEFAULT_ROLES.ADMIN],
            permissions: [],
         };

         const result = await service.refundPayment(dto, 'corr-test-id', adminUser);

         expect(result).toEqual(expectedResponse);
         expect(mockPaymentGrpcService.refundPayment).toHaveBeenCalledWith(
            {
               transactionId: 'tx-12345',
               amount: 100000,
               reason: 'Damaged item on arrival',
            },
            expect.anything(),
         );

         expect(capturedMetadata).toBeDefined();
         const rolesHeader = capturedMetadata?.get('x-user-roles');
         expect(rolesHeader?.[0]).toContain(DEFAULT_ROLES.ADMIN);
         const userIdHeader = capturedMetadata?.get('x-user-id');
         expect(userIdHeader?.[0]).toBe('admin-uuid-001');
      });

      it('should handle gRPC errors gracefully through handleGrpcError', async () => {
         const grpcError = Object.assign(
            new Error('7 PERMISSION_DENIED: {"statusCode":403,"errorCode":"COMMON.INSUFFICIENT_ROLES"}'),
            {
               code: 7,
               details: JSON.stringify({
                  statusCode: 403,
                  errorCode: 'COMMON.INSUFFICIENT_ROLES',
               }),
            },
         );

         mockPaymentGrpcService.refundPayment.mockImplementation(() => throwError(() => grpcError));

         const dto: RefundPaymentDto = {
            transactionId: 'tx-unauth',
            amount: 50000,
         };

         await expect(service.refundPayment(dto, 'corr-err')).rejects.toThrow();
      });
   });

   describe('getPaymentById', () => {
      it('should inject caller user context and correlationId into gRPC metadata', async () => {
         const mockTx = {
            transactionId: 'tx-100',
            orderId: 'ord-100',
            userId: 'user-100',
            amount: 75000,
            currency: 'VND',
            paymentMethod: 'MOMO',
            paymentStatus: 'COMPLETED',
            providerTransactionId: 'momo-tx-100',
            paymentUrl: '',
            failureReason: '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
         };

         let capturedMetadata: Metadata | undefined;
         mockPaymentGrpcService.getPaymentById.mockImplementation((_req, metadata) => {
            capturedMetadata = metadata;
            return of({ transaction: mockTx });
         });

         const user: JwtPayload = {
            sub: 'user-100',
            email: 'user100@omni.vn',
            roles: [DEFAULT_ROLES.USER],
            permissions: [],
         };

         const result = await service.getPaymentById('tx-100', user, 'corr-get-id');

         expect(result).toEqual(mockTx);
         expect(mockPaymentGrpcService.getPaymentById).toHaveBeenCalledWith(
            { transactionId: 'tx-100' },
            expect.anything(),
         );

         expect(capturedMetadata).toBeDefined();
         expect(capturedMetadata?.get('x-user-id')?.[0]).toBe('user-100');
         expect(capturedMetadata?.get('x-user-roles')?.[0]).toContain(DEFAULT_ROLES.USER);
         expect(capturedMetadata?.get('x-correlation-id')?.[0]).toBe('corr-get-id');
      });

      it('should handle gRPC PERMISSION_DENIED error when user does not own transaction', async () => {
         const grpcError = Object.assign(
            new Error('7 PERMISSION_DENIED: {"statusCode":403,"errorCode":"COMMON.NOT_OWNER_OR_ADMIN"}'),
            {
               code: 7,
               details: JSON.stringify({
                  statusCode: 403,
                  errorCode: 'COMMON.NOT_OWNER_OR_ADMIN',
               }),
            },
         );

         mockPaymentGrpcService.getPaymentById.mockImplementation(() => throwError(() => grpcError));

         const user: JwtPayload = {
            sub: 'attacker-uuid',
            email: 'attacker@evil.com',
            roles: [DEFAULT_ROLES.USER],
            permissions: [],
         };

         await expect(service.getPaymentById('tx-100', user, 'corr-attack')).rejects.toThrow();
      });
   });

   describe('getPaymentByOrderId', () => {
      it('should inject caller user context and correlationId into gRPC metadata', async () => {
         const mockTx = {
            transactionId: 'tx-200',
            orderId: 'ord-200',
            userId: 'user-200',
            amount: 150000,
            currency: 'VND',
            paymentMethod: 'VNPAY',
            paymentStatus: 'COMPLETED',
            providerTransactionId: 'vnpay-200',
            paymentUrl: '',
            failureReason: '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
         };

         let capturedMetadata: Metadata | undefined;
         mockPaymentGrpcService.getPaymentByOrderId.mockImplementation((_req, metadata) => {
            capturedMetadata = metadata;
            return of({ transaction: mockTx });
         });

         const user: JwtPayload = {
            sub: 'user-200',
            email: 'user200@omni.vn',
            roles: [DEFAULT_ROLES.USER],
            permissions: [],
         };

         const result = await service.getPaymentByOrderId('ord-200', user, 'corr-get-order');

         expect(result).toEqual(mockTx);
         expect(mockPaymentGrpcService.getPaymentByOrderId).toHaveBeenCalledWith(
            { orderId: 'ord-200' },
            expect.anything(),
         );

         expect(capturedMetadata).toBeDefined();
         expect(capturedMetadata?.get('x-user-id')?.[0]).toBe('user-200');
         expect(capturedMetadata?.get('x-user-roles')?.[0]).toContain(DEFAULT_ROLES.USER);
         expect(capturedMetadata?.get('x-correlation-id')?.[0]).toBe('corr-get-order');
      });

      it('should handle gRPC PERMISSION_DENIED error when caller does not own order payment', async () => {
         const grpcError = Object.assign(
            new Error('7 PERMISSION_DENIED: {"statusCode":403,"errorCode":"COMMON.NOT_OWNER_OR_ADMIN"}'),
            {
               code: 7,
               details: JSON.stringify({
                  statusCode: 403,
                  errorCode: 'COMMON.NOT_OWNER_OR_ADMIN',
               }),
            },
         );

         mockPaymentGrpcService.getPaymentByOrderId.mockImplementation(() => throwError(() => grpcError));

         const user: JwtPayload = {
            sub: 'attacker-uuid',
            email: 'attacker@evil.com',
            roles: [DEFAULT_ROLES.USER],
            permissions: [],
         };

         await expect(service.getPaymentByOrderId('ord-200', user, 'corr-attack')).rejects.toThrow();
      });
   });
});
