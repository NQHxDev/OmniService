import { Test, TestingModule } from '@nestjs/testing';
import { firstValueFrom } from 'rxjs';
import {
   COMMON_ERROR_CODES,
   createGrpcMetadata,
   DEFAULT_ROLES,
   ForbiddenException,
   UnauthorizedException,
} from '@common';
import type { IRefundPaymentRequest, IRefundPaymentResponse } from '@contracts/payment';
import { PaymentGrpcController } from '@payment/adapters/payment-grpc.controller';
import { PaymentService } from '@payment/services/payment.service';

describe('PaymentGrpcController', () => {
   let controller: PaymentGrpcController;
   let mockPaymentService: {
      initiatePayment: jest.Mock;
      getPaymentById: jest.Mock;
      getPaymentByOrderId: jest.Mock;
      processWebhook: jest.Mock;
      refundPayment: jest.Mock;
   };

   const sampleRefundRequest: IRefundPaymentRequest = {
      transactionId: 't0000000-0000-0000-0000-000000000001',
      amount: 50000,
      reason: 'Customer cancellation',
   };

   const sampleRefundResponse: IRefundPaymentResponse = {
      success: true,
      message: 'PAYMENT.REFUND_SUCCESS',
      refundId: 'ref-001',
   };

   beforeEach(async () => {
      mockPaymentService = {
         initiatePayment: jest.fn(),
         getPaymentById: jest.fn(),
         getPaymentByOrderId: jest.fn(),
         processWebhook: jest.fn(),
         refundPayment: jest.fn(),
      };

      const module: TestingModule = await Test.createTestingModule({
         controllers: [PaymentGrpcController],
         providers: [
            {
               provide: PaymentService,
               useValue: mockPaymentService,
            },
         ],
      }).compile();

      controller = module.get<PaymentGrpcController>(PaymentGrpcController);
   });

   describe('refundPayment', () => {
      it('should allow refundPayment when caller has ADMIN role in gRPC metadata', async () => {
         mockPaymentService.refundPayment.mockResolvedValue(sampleRefundResponse);

         const adminMetadata = createGrpcMetadata({
            userId: 'admin-001',
            roles: [DEFAULT_ROLES.ADMIN],
         });

         const response$ = controller.refundPayment(sampleRefundRequest, adminMetadata);
         const result = await firstValueFrom(response$);

         expect(result).toEqual(sampleRefundResponse);
         expect(mockPaymentService.refundPayment).toHaveBeenCalledWith(sampleRefundRequest, adminMetadata);
      });

      it('should throw ForbiddenException when caller lacks ADMIN role in gRPC metadata', () => {
         const userMetadata = createGrpcMetadata({
            userId: 'user-001',
            roles: ['USER'],
         });

         expect(() => controller.refundPayment(sampleRefundRequest, userMetadata)).toThrow(ForbiddenException);
         expect(() => controller.refundPayment(sampleRefundRequest, userMetadata)).toThrow(
            COMMON_ERROR_CODES.INSUFFICIENT_ROLES,
         );
         expect(mockPaymentService.refundPayment).not.toHaveBeenCalled();
      });

      it('should throw UnauthorizedException when gRPC metadata is missing or lacks user context', () => {
         expect(() => controller.refundPayment(sampleRefundRequest, undefined)).toThrow(UnauthorizedException);
         expect(() => controller.refundPayment(sampleRefundRequest, undefined)).toThrow(
            COMMON_ERROR_CODES.MISSING_USER_CONTEXT,
         );
         expect(mockPaymentService.refundPayment).not.toHaveBeenCalled();
      });
   });

   describe('getPaymentById', () => {
      it('should forward request and metadata to paymentService.getPaymentById', async () => {
         const mockTx = {
            transactionId: 't0000000-0000-0000-0000-000000000001',
            orderId: 'o0000000-0000-0000-0000-000000000001',
            userId: 'u0000000-0000-0000-0000-000000000001',
            amount: 50000,
            currency: 'VND',
            paymentMethod: 'VNPAY',
            paymentStatus: 'COMPLETED',
            providerTransactionId: 'p-1',
            paymentUrl: '',
            failureReason: '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
         };
         mockPaymentService.getPaymentById.mockResolvedValue(mockTx);

         const userMetadata = createGrpcMetadata({
            userId: 'u0000000-0000-0000-0000-000000000001',
            roles: ['USER'],
         });

         const response$ = controller.getPaymentById(
            { transactionId: 't0000000-0000-0000-0000-000000000001' },
            userMetadata,
         );
         const result = await firstValueFrom(response$);

         expect(result).toEqual({ transaction: mockTx });
         expect(mockPaymentService.getPaymentById).toHaveBeenCalledWith(
            't0000000-0000-0000-0000-000000000001',
            userMetadata,
         );
      });
   });

   describe('getPaymentByOrderId', () => {
      it('should forward request and metadata to paymentService.getPaymentByOrderId', async () => {
         const mockTx = {
            transactionId: 't0000000-0000-0000-0000-000000000001',
            orderId: 'o0000000-0000-0000-0000-000000000001',
            userId: 'u0000000-0000-0000-0000-000000000001',
            amount: 50000,
            currency: 'VND',
            paymentMethod: 'VNPAY',
            paymentStatus: 'COMPLETED',
            providerTransactionId: 'p-1',
            paymentUrl: '',
            failureReason: '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
         };
         mockPaymentService.getPaymentByOrderId.mockResolvedValue(mockTx);

         const userMetadata = createGrpcMetadata({
            userId: 'u0000000-0000-0000-0000-000000000001',
            roles: ['USER'],
         });

         const response$ = controller.getPaymentByOrderId(
            { orderId: 'o0000000-0000-0000-0000-000000000001' },
            userMetadata,
         );
         const result = await firstValueFrom(response$);

         expect(result).toEqual({ transaction: mockTx });
         expect(mockPaymentService.getPaymentByOrderId).toHaveBeenCalledWith(
            'o0000000-0000-0000-0000-000000000001',
            userMetadata,
         );
      });
   });
});
