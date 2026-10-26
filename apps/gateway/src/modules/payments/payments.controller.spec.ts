import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import { CORRELATION_ID_HEADER, DEFAULT_ROLES, type JwtPayload, ROLES_KEY } from '@common';
import type { PaymentTransactionResponseDto, RefundPaymentDto } from '@contracts/payment';
import { PaymentsController } from '@/modules/payments/payments.controller';
import { PaymentsService } from '@/modules/payments/payments.service';

describe('PaymentsController', () => {
   let controller: PaymentsController;
   let mockPaymentsService: jest.Mocked<PaymentsService>;
   let reflector: Reflector;

   beforeEach(async () => {
      mockPaymentsService = {
         initiatePayment: jest.fn(),
         getPaymentById: jest.fn(),
         getPaymentByOrderId: jest.fn(),
         refundPayment: jest.fn(),
         processWebhookGet: jest.fn(),
         processWebhookPost: jest.fn(),
      } as unknown as jest.Mocked<PaymentsService>;

      const module: TestingModule = await Test.createTestingModule({
         controllers: [PaymentsController],
         providers: [
            Reflector,
            {
               provide: PaymentsService,
               useValue: mockPaymentsService,
            },
         ],
      }).compile();

      controller = module.get<PaymentsController>(PaymentsController);
      reflector = module.get<Reflector>(Reflector);
   });

   describe('refundPayment authorization & execution', () => {
      it('should have RequireRoles decorator demanding ADMIN role', () => {
         const roles = reflector.get<string[]>(ROLES_KEY, controller.refundPayment);
         expect(roles).toBeDefined();
         expect(roles).toEqual([DEFAULT_ROLES.ADMIN]);
      });

      it('should forward DTO, correlationId, and caller user context to PaymentsService', async () => {
         const refundResult = {
            success: true,
            message: 'PAYMENT.REFUND_SUCCESS',
            refundId: 'ref-123456',
         };
         mockPaymentsService.refundPayment.mockResolvedValue(refundResult);

         const dto: RefundPaymentDto = {
            transactionId: 't0000000-0000-0000-0000-000000000001',
            amount: 50000,
            reason: 'Customer requested cancellation',
         };

         const mockReq = {
            headers: {
               [CORRELATION_ID_HEADER]: 'corr-refund-test',
            },
         } as unknown as Request;

         const mockAdminUser: JwtPayload = {
            sub: 'admin-user-uuid',
            email: 'admin@omniservices.com',
            roles: [DEFAULT_ROLES.ADMIN],
            permissions: [],
         };

         const result = await controller.refundPayment(dto, mockReq, mockAdminUser);

         expect(mockPaymentsService.refundPayment).toHaveBeenCalledWith(dto, 'corr-refund-test', mockAdminUser);
         expect(result).toEqual(refundResult);
      });
   });

   describe('getPaymentById', () => {
      it('should forward transactionId, user context, and correlationId to PaymentsService', async () => {
         const mockTransaction = {
            transactionId: 'tx-123',
            orderId: 'ord-123',
            userId: 'user-001',
            amount: 50000,
            currency: 'VND',
            paymentMethod: 'VNPAY',
            paymentStatus: 'COMPLETED',
         };
         mockPaymentsService.getPaymentById.mockResolvedValue(
            mockTransaction as unknown as PaymentTransactionResponseDto,
         );

         const mockReq = {
            headers: {
               [CORRELATION_ID_HEADER]: 'corr-get-by-id',
            },
         } as unknown as Request;

         const mockUser: JwtPayload = {
            sub: 'user-001',
            email: 'user@example.com',
            roles: ['USER'],
            permissions: [],
         };

         const result = await controller.getPaymentById('tx-123', mockUser, mockReq);

         expect(mockPaymentsService.getPaymentById).toHaveBeenCalledWith('tx-123', mockUser, 'corr-get-by-id');
         expect(result).toEqual(mockTransaction);
      });
   });

   describe('getPaymentByOrderId', () => {
      it('should forward orderId, user context, and correlationId to PaymentsService', async () => {
         const mockTransaction = {
            transactionId: 'tx-123',
            orderId: 'ord-123',
            userId: 'user-001',
            amount: 50000,
            currency: 'VND',
            paymentMethod: 'VNPAY',
            paymentStatus: 'COMPLETED',
         };
         mockPaymentsService.getPaymentByOrderId.mockResolvedValue(
            mockTransaction as unknown as PaymentTransactionResponseDto,
         );

         const mockReq = {
            headers: {
               [CORRELATION_ID_HEADER]: 'corr-get-by-order',
            },
         } as unknown as Request;

         const mockUser: JwtPayload = {
            sub: 'user-001',
            email: 'user@example.com',
            roles: ['USER'],
            permissions: [],
         };

         const result = await controller.getPaymentByOrderId('ord-123', mockUser, mockReq);

         expect(mockPaymentsService.getPaymentByOrderId).toHaveBeenCalledWith('ord-123', mockUser, 'corr-get-by-order');
         expect(result).toEqual(mockTransaction);
      });
   });
});
