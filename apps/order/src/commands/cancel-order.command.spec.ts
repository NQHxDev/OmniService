import { status as GrpcStatus } from '@grpc/grpc-js';
import { RpcException } from '@nestjs/microservices';
import { COMMON_ERROR_CODES, createGrpcMetadata, DEFAULT_ROLES } from '@common';
import { ORDER_ERROR_CODES } from '@contracts/order';
import { Prisma } from '@order/prisma-client';
import type { PrismaService } from '@order/prisma/prisma.service';
import type { OrderMetricsService } from '@order/services/order-metrics.service';
import type { OrderWithItems } from '@order/entities';
import { CancelOrderCommandHandler } from '@order/commands/cancel-order.command';

describe('CancelOrderCommandHandler - BOLA Prevention', () => {
   let handler: CancelOrderCommandHandler;
   let prisma: {
      order: {
         findUnique: jest.Mock;
      };
      outboxEvent: {
         create: jest.Mock;
      };
   };
   let uow: {
      runInTransaction: jest.Mock;
   };
   let metricsService: {
      recordOrderEvent: jest.Mock;
   };
   let mockOrderRepository: {
      cancel: jest.Mock;
   };

   const sampleOrder: OrderWithItems = {
      orderId: 'order-uuid-1',
      userId: 'owner-uuid',
      orderNumber: 'ORD-12345',
      orderStatus: 'PENDING',
      paymentMethod: 'VNPAY',
      paymentStatus: 'PENDING',
      totalAmount: new Prisma.Decimal(100000),
      shippingFee: new Prisma.Decimal(15000),
      shippingAddress: '123 Test St',
      receiverName: 'John Doe',
      receiverPhone: '0901234567',
      note: 'Deliver during day',
      version: 1,
      deletedAt: null,
      createdAt: new Date('2026-10-25T10:00:00Z'),
      updatedAt: new Date('2026-10-25T10:00:00Z'),
      items: [
         {
            orderItemId: 'item-uuid-1',
            orderId: 'order-uuid-1',
            productId: 'prod-uuid-1',
            productName: 'Sample Product',
            quantity: 2,
            unitPrice: new Prisma.Decimal(50000),
            totalPrice: new Prisma.Decimal(100000),
            createdAt: new Date('2026-10-25T10:00:00Z'),
            updatedAt: new Date('2026-10-25T10:00:00Z'),
         },
      ],
   };

   beforeEach(() => {
      mockOrderRepository = {
         cancel: jest.fn(),
      };

      prisma = {
         order: {
            findUnique: jest.fn(),
         },
         outboxEvent: {
            create: jest.fn(),
         },
      };

      uow = {
         runInTransaction: jest.fn((cb: (repos: { orderRepository: typeof mockOrderRepository }) => unknown) =>
            cb({ orderRepository: mockOrderRepository }),
         ),
      };

      metricsService = {
         recordOrderEvent: jest.fn(),
      };

      handler = new CancelOrderCommandHandler(
         uow,
         prisma as unknown as PrismaService,
         metricsService as unknown as OrderMetricsService,
      );
   });

   it('should allow cancellation when caller is the order owner', async () => {
      prisma.order.findUnique.mockResolvedValue(sampleOrder);
      const cancelledOrder = { ...sampleOrder, orderStatus: 'CANCELLED' };
      mockOrderRepository.cancel.mockResolvedValue(cancelledOrder);
      prisma.outboxEvent.create.mockResolvedValue({});

      const result = await handler.execute({
         orderId: sampleOrder.orderId,
         userId: 'owner-uuid',
         reason: 'Changed my mind',
      });

      expect(result.orderStatus).toBe('CANCELLED');
      expect(mockOrderRepository.cancel).toHaveBeenCalledWith(sampleOrder.orderId, 'Changed my mind');
      expect(prisma.outboxEvent.create).toHaveBeenCalled();
      expect(metricsService.recordOrderEvent).toHaveBeenCalledWith('CANCELLED', sampleOrder.paymentMethod);
   });

   it('should allow cancellation when caller is an admin', async () => {
      prisma.order.findUnique.mockResolvedValue(sampleOrder);
      const cancelledOrder = { ...sampleOrder, orderStatus: 'CANCELLED' };
      mockOrderRepository.cancel.mockResolvedValue(cancelledOrder);
      prisma.outboxEvent.create.mockResolvedValue({});

      const adminMetadata = createGrpcMetadata({
         userId: 'admin-uuid',
         roles: [DEFAULT_ROLES.ADMIN],
      });

      const result = await handler.execute(
         {
            orderId: sampleOrder.orderId,
            userId: 'admin-uuid',
            reason: 'Admin forced cancellation',
         },
         adminMetadata,
      );

      expect(result.orderStatus).toBe('CANCELLED');
   });

   it('should throw RpcException PERMISSION_DENIED when caller is not the owner and not admin (BOLA attempt)', async () => {
      prisma.order.findUnique.mockResolvedValue(sampleOrder);

      const attackerMetadata = createGrpcMetadata({
         userId: 'attacker-uuid',
         roles: [DEFAULT_ROLES.USER],
      });

      try {
         await handler.execute(
            {
               orderId: sampleOrder.orderId,
               userId: 'attacker-uuid',
               reason: 'Malicious cancellation',
            },
            attackerMetadata,
         );
         fail('Expected handler.execute to throw RpcException');
      } catch (error) {
         expect(error).toBeInstanceOf(RpcException);
         const rpcError = (error as RpcException).getError() as { code: number; message: string };
         expect(rpcError.code).toBe(GrpcStatus.PERMISSION_DENIED);
         expect(rpcError.message).toBe(ORDER_ERROR_CODES.UNAUTHORIZED_ACCESS);
      }

      expect(mockOrderRepository.cancel).not.toHaveBeenCalled();
   });

   it('should throw RpcException UNAUTHENTICATED when userId is missing or empty (preventing BOLA bypass)', async () => {
      try {
         await handler.execute({
            orderId: sampleOrder.orderId,
            userId: '',
            reason: 'Bypass attempt without userId',
         });
         fail('Expected handler.execute to throw RpcException');
      } catch (error) {
         expect(error).toBeInstanceOf(RpcException);
         const rpcError = (error as RpcException).getError() as { code: number; message: string };
         expect(rpcError.code).toBe(GrpcStatus.UNAUTHENTICATED);
         expect(rpcError.message).toBe(COMMON_ERROR_CODES.UNAUTHORIZED);
      }

      expect(prisma.order.findUnique).not.toHaveBeenCalled();
      expect(mockOrderRepository.cancel).not.toHaveBeenCalled();
   });

   it('should throw RpcException NOT_FOUND when order does not exist', async () => {
      prisma.order.findUnique.mockResolvedValue(null);

      try {
         await handler.execute({
            orderId: 'non-existent-order',
            userId: 'some-user',
         });
         fail('Expected handler.execute to throw RpcException');
      } catch (error) {
         expect(error).toBeInstanceOf(RpcException);
         const rpcError = (error as RpcException).getError() as { code: number; message: string };
         expect(rpcError.code).toBe(GrpcStatus.NOT_FOUND);
         expect(rpcError.message).toBe(ORDER_ERROR_CODES.NOT_FOUND);
      }
   });

   it('should throw RpcException FAILED_PRECONDITION when order is already in a non-cancellable state', async () => {
      const deliveredOrder = { ...sampleOrder, orderStatus: 'DELIVERED' };
      prisma.order.findUnique.mockResolvedValue(deliveredOrder);

      try {
         await handler.execute({
            orderId: deliveredOrder.orderId,
            userId: 'owner-uuid',
         });
         fail('Expected handler.execute to throw RpcException');
      } catch (error) {
         expect(error).toBeInstanceOf(RpcException);
         const rpcError = (error as RpcException).getError() as { code: number; message: string };
         expect(rpcError.code).toBe(GrpcStatus.FAILED_PRECONDITION);
         expect(rpcError.message).toBe(ORDER_ERROR_CODES.CANNOT_CANCEL_IN_CURRENT_STATE);
      }

      expect(mockOrderRepository.cancel).not.toHaveBeenCalled();
   });
});
