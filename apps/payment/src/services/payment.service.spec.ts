import { Test, TestingModule } from '@nestjs/testing';
import { RpcException } from '@nestjs/microservices';
import {
   COMMON_ERROR_CODES,
   createGrpcMetadata,
   DEFAULT_ROLES,
   ForbiddenException,
   SERVICES,
   UnauthorizedException,
} from '@common';
import { PaymentService } from '@payment/services/payment.service';
import { PrismaService } from '@payment/prisma/prisma.service';
import { PaymentRepository } from '@payment/repositories/payment.repository';
import { PaymentProviderFactory } from '@payment/providers/payment-provider.factory';
import { PaymentMetricsService } from '@payment/services/payment-metrics.service';
import { PaymentMethodEnum, PaymentStatusEnum, type PaymentTransaction } from '@payment/prisma-client';

describe('PaymentService - BOLA / IDOR Prevention', () => {
   let service: PaymentService;
   let mockPaymentRepository: {
      findById: jest.Mock;
      findByOrderId: jest.Mock;
   };

   const sampleTransaction: PaymentTransaction = {
      transactionId: 't0000000-0000-0000-0000-000000000001',
      orderId: 'o0000000-0000-0000-0000-000000000001',
      userId: 'user-owner-uuid',
      amount: 150000 as unknown as PaymentTransaction['amount'],
      currency: 'VND',
      paymentMethod: PaymentMethodEnum.VNPAY,
      paymentStatus: PaymentStatusEnum.SUCCESS,
      providerTransactionId: 'vnpay-tx-12345',
      paymentUrl: 'https://sandbox.vnpayment.vn',
      failureReason: null,
      metadata: null,
      version: 1,
      createdAt: new Date('2026-10-26T00:00:00.000Z'),
      updatedAt: new Date('2026-10-26T00:01:00.000Z'),
   };

   beforeEach(async () => {
      mockPaymentRepository = {
         findById: jest.fn(),
         findByOrderId: jest.fn(),
      };

      const mockPrisma = {};
      const mockProviderFactory = {
         getProvider: jest.fn(),
      };
      const mockMetricsService = {
         recordPaymentEvent: jest.fn(),
      };
      const mockOrderClient = {
         emit: jest.fn(),
      };

      const module: TestingModule = await Test.createTestingModule({
         providers: [
            PaymentService,
            { provide: PrismaService, useValue: mockPrisma },
            { provide: PaymentRepository, useValue: mockPaymentRepository },
            { provide: PaymentProviderFactory, useValue: mockProviderFactory },
            { provide: PaymentMetricsService, useValue: mockMetricsService },
            { provide: SERVICES.ORDER_SERVICE, useValue: mockOrderClient },
         ],
      }).compile();

      service = module.get<PaymentService>(PaymentService);
   });

   describe('getPaymentById', () => {
      it('should allow transaction retrieval when caller is the transaction owner', async () => {
         mockPaymentRepository.findById.mockResolvedValue(sampleTransaction);

         const ownerMetadata = createGrpcMetadata({
            userId: 'user-owner-uuid',
            roles: [DEFAULT_ROLES.USER],
         });

         const result = await service.getPaymentById(sampleTransaction.transactionId, ownerMetadata);

         expect(result.transactionId).toBe(sampleTransaction.transactionId);
         expect(result.userId).toBe('user-owner-uuid');
         expect(mockPaymentRepository.findById).toHaveBeenCalledWith(sampleTransaction.transactionId);
      });

      it('should allow transaction retrieval when caller has ADMIN role', async () => {
         mockPaymentRepository.findById.mockResolvedValue(sampleTransaction);

         const adminMetadata = createGrpcMetadata({
            userId: 'admin-uuid',
            roles: [DEFAULT_ROLES.ADMIN],
         });

         const result = await service.getPaymentById(sampleTransaction.transactionId, adminMetadata);

         expect(result.transactionId).toBe(sampleTransaction.transactionId);
         expect(result.userId).toBe('user-owner-uuid');
         expect(mockPaymentRepository.findById).toHaveBeenCalledWith(sampleTransaction.transactionId);
      });

      it('should throw ForbiddenException when caller is not the owner and not an admin (BOLA attempt)', async () => {
         mockPaymentRepository.findById.mockResolvedValue(sampleTransaction);

         const attackerMetadata = createGrpcMetadata({
            userId: 'attacker-uuid',
            roles: [DEFAULT_ROLES.USER],
         });

         await expect(service.getPaymentById(sampleTransaction.transactionId, attackerMetadata)).rejects.toThrow(
            ForbiddenException,
         );
         await expect(service.getPaymentById(sampleTransaction.transactionId, attackerMetadata)).rejects.toThrow(
            COMMON_ERROR_CODES.NOT_OWNER_OR_ADMIN,
         );
      });

      it('should throw UnauthorizedException when gRPC metadata lacks user context', async () => {
         mockPaymentRepository.findById.mockResolvedValue(sampleTransaction);

         await expect(service.getPaymentById(sampleTransaction.transactionId, undefined)).rejects.toThrow(
            UnauthorizedException,
         );
         await expect(service.getPaymentById(sampleTransaction.transactionId, undefined)).rejects.toThrow(
            COMMON_ERROR_CODES.MISSING_USER_CONTEXT,
         );
      });

      it('should throw RpcException NOT_FOUND when transaction does not exist', async () => {
         mockPaymentRepository.findById.mockResolvedValue(null);

         const userMetadata = createGrpcMetadata({
            userId: 'any-user-uuid',
            roles: [DEFAULT_ROLES.USER],
         });

         await expect(service.getPaymentById('non-existent-id', userMetadata)).rejects.toThrow(RpcException);
      });
   });

   describe('getPaymentByOrderId', () => {
      it('should allow transaction retrieval by orderId when caller is the transaction owner', async () => {
         mockPaymentRepository.findByOrderId.mockResolvedValue(sampleTransaction);

         const ownerMetadata = createGrpcMetadata({
            userId: 'user-owner-uuid',
            roles: [DEFAULT_ROLES.USER],
         });

         const result = await service.getPaymentByOrderId(sampleTransaction.orderId, ownerMetadata);

         expect(result.transactionId).toBe(sampleTransaction.transactionId);
         expect(result.orderId).toBe(sampleTransaction.orderId);
         expect(result.userId).toBe('user-owner-uuid');
         expect(mockPaymentRepository.findByOrderId).toHaveBeenCalledWith(sampleTransaction.orderId);
      });

      it('should allow transaction retrieval by orderId when caller has ADMIN role', async () => {
         mockPaymentRepository.findByOrderId.mockResolvedValue(sampleTransaction);

         const adminMetadata = createGrpcMetadata({
            userId: 'admin-uuid',
            roles: [DEFAULT_ROLES.ADMIN],
         });

         const result = await service.getPaymentByOrderId(sampleTransaction.orderId, adminMetadata);

         expect(result.transactionId).toBe(sampleTransaction.transactionId);
         expect(result.orderId).toBe(sampleTransaction.orderId);
         expect(mockPaymentRepository.findByOrderId).toHaveBeenCalledWith(sampleTransaction.orderId);
      });

      it('should throw ForbiddenException when caller is not the owner of the order payment', async () => {
         mockPaymentRepository.findByOrderId.mockResolvedValue(sampleTransaction);

         const attackerMetadata = createGrpcMetadata({
            userId: 'attacker-uuid',
            roles: [DEFAULT_ROLES.USER],
         });

         await expect(service.getPaymentByOrderId(sampleTransaction.orderId, attackerMetadata)).rejects.toThrow(
            ForbiddenException,
         );
         await expect(service.getPaymentByOrderId(sampleTransaction.orderId, attackerMetadata)).rejects.toThrow(
            COMMON_ERROR_CODES.NOT_OWNER_OR_ADMIN,
         );
      });

      it('should throw UnauthorizedException when metadata lacks user context for order payment lookup', async () => {
         mockPaymentRepository.findByOrderId.mockResolvedValue(sampleTransaction);

         await expect(service.getPaymentByOrderId(sampleTransaction.orderId, undefined)).rejects.toThrow(
            UnauthorizedException,
         );
         await expect(service.getPaymentByOrderId(sampleTransaction.orderId, undefined)).rejects.toThrow(
            COMMON_ERROR_CODES.MISSING_USER_CONTEXT,
         );
      });

      it('should throw RpcException NOT_FOUND when order payment does not exist', async () => {
         mockPaymentRepository.findByOrderId.mockResolvedValue(null);

         const userMetadata = createGrpcMetadata({
            userId: 'any-user-uuid',
            roles: [DEFAULT_ROLES.USER],
         });

         await expect(service.getPaymentByOrderId('non-existent-order-id', userMetadata)).rejects.toThrow(RpcException);
      });
   });
});
