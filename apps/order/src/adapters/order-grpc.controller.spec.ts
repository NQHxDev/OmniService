import { status as GrpcStatus } from '@grpc/grpc-js';
import { RpcException } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { COMMON_ERROR_CODES } from '@common';
import { Prisma } from '@order/prisma-client';
import { OrderGrpcController } from '@order/adapters/order-grpc.controller';
import type {
   CancelOrderCommandHandler,
   CreateOrderCommandHandler,
   UpdateOrderStatusCommandHandler,
} from '@order/commands';
import type { GetOrderByIdQueryHandler, GetOrdersByUserIdQueryHandler } from '@order/queries';
import type { OrderWithItems } from '@order/entities';

describe('OrderGrpcController', () => {
   let controller: OrderGrpcController;
   let mockCreateOrderHandler: { execute: jest.Mock };
   let mockCancelOrderHandler: { execute: jest.Mock };
   let mockUpdateOrderStatusHandler: { execute: jest.Mock };
   let mockGetOrderByIdHandler: { execute: jest.Mock };
   let mockGetOrdersByUserIdHandler: { execute: jest.Mock };

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
      mockCreateOrderHandler = { execute: jest.fn() };
      mockCancelOrderHandler = { execute: jest.fn() };
      mockUpdateOrderStatusHandler = { execute: jest.fn() };
      mockGetOrderByIdHandler = { execute: jest.fn() };
      mockGetOrdersByUserIdHandler = { execute: jest.fn() };

      controller = new OrderGrpcController(
         mockCreateOrderHandler as unknown as CreateOrderCommandHandler,
         mockCancelOrderHandler as unknown as CancelOrderCommandHandler,
         mockUpdateOrderStatusHandler as unknown as UpdateOrderStatusCommandHandler,
         mockGetOrderByIdHandler as unknown as GetOrderByIdQueryHandler,
         mockGetOrdersByUserIdHandler as unknown as GetOrdersByUserIdQueryHandler,
      );
   });

   describe('getOrderById', () => {
      it('should validate userId and delegate to getOrderByIdHandler', async () => {
         mockGetOrderByIdHandler.execute.mockResolvedValue(sampleOrder);

         const response = await firstValueFrom(
            controller.getOrderById({ orderId: sampleOrder.orderId, userId: 'owner-uuid' }),
         );

         expect(response.order.orderId).toBe(sampleOrder.orderId);
         expect(mockGetOrderByIdHandler.execute).toHaveBeenCalledWith(
            { orderId: sampleOrder.orderId, userId: 'owner-uuid' },
            undefined,
         );
      });

      it('should throw RpcException UNAUTHENTICATED when userId is missing', () => {
         expect(() => controller.getOrderById({ orderId: sampleOrder.orderId, userId: '' })).toThrow(RpcException);

         try {
            controller.getOrderById({ orderId: sampleOrder.orderId, userId: '' });
         } catch (error) {
            expect(error).toBeInstanceOf(RpcException);
            const rpcError = (error as RpcException).getError() as { code: number; message: string };
            expect(rpcError.code).toBe(GrpcStatus.UNAUTHENTICATED);
            expect(rpcError.message).toBe(COMMON_ERROR_CODES.UNAUTHORIZED);
         }

         expect(mockGetOrderByIdHandler.execute).not.toHaveBeenCalled();
      });
   });

   describe('cancelOrder', () => {
      it('should validate userId and delegate to cancelOrderHandler', async () => {
         const cancelledOrder = { ...sampleOrder, orderStatus: 'CANCELLED' };
         mockCancelOrderHandler.execute.mockResolvedValue(cancelledOrder);

         const response = await firstValueFrom(
            controller.cancelOrder({
               orderId: sampleOrder.orderId,
               userId: 'owner-uuid',
               reason: 'Mistake',
            }),
         );

         expect(response.order.orderStatus).toBe('CANCELLED');
         expect(mockCancelOrderHandler.execute).toHaveBeenCalled();
      });

      it('should throw RpcException UNAUTHENTICATED when userId is missing', () => {
         expect(() => controller.cancelOrder({ orderId: sampleOrder.orderId, userId: '' })).toThrow(RpcException);

         try {
            controller.cancelOrder({ orderId: sampleOrder.orderId, userId: '' });
         } catch (error) {
            expect(error).toBeInstanceOf(RpcException);
            const rpcError = (error as RpcException).getError() as { code: number; message: string };
            expect(rpcError.code).toBe(GrpcStatus.UNAUTHENTICATED);
            expect(rpcError.message).toBe(COMMON_ERROR_CODES.UNAUTHORIZED);
         }

         expect(mockCancelOrderHandler.execute).not.toHaveBeenCalled();
      });
   });

   describe('getOrdersByUserId', () => {
      it('should validate userId and delegate to getOrdersByUserIdHandler', async () => {
         mockGetOrdersByUserIdHandler.execute.mockResolvedValue({
            orders: [sampleOrder],
            total: 1,
            page: 1,
            limit: 10,
         });

         const response = await firstValueFrom(
            controller.getOrdersByUserId({ userId: 'owner-uuid', page: 1, limit: 10 }),
         );

         expect(response.orders).toHaveLength(1);
         expect(response.total).toBe(1);
         expect(mockGetOrdersByUserIdHandler.execute).toHaveBeenCalled();
      });

      it('should throw RpcException UNAUTHENTICATED when userId is empty', () => {
         expect(() => controller.getOrdersByUserId({ userId: '' })).toThrow(RpcException);

         expect(mockGetOrdersByUserIdHandler.execute).not.toHaveBeenCalled();
      });
   });

   describe('createOrder', () => {
      it('should validate userId and delegate to createOrderHandler', async () => {
         mockCreateOrderHandler.execute.mockResolvedValue(sampleOrder);

         const response = await firstValueFrom(
            controller.createOrder({
               userId: 'owner-uuid',
               paymentMethod: 'COD',
               shippingAddress: '123 St',
               receiverName: 'John',
               receiverPhone: '0901234567',
               items: [{ productId: 'p1', productName: 'Item 1', quantity: 1, unitPrice: 50000 }],
            }),
         );

         expect(response.order.orderId).toBe(sampleOrder.orderId);
         expect(mockCreateOrderHandler.execute).toHaveBeenCalled();
      });

      it('should throw RpcException UNAUTHENTICATED when userId is missing', () => {
         expect(() =>
            controller.createOrder({
               userId: '',
               paymentMethod: 'COD',
               shippingAddress: '123 St',
               receiverName: 'John',
               receiverPhone: '0901234567',
               items: [],
            }),
         ).toThrow(RpcException);

         expect(mockCreateOrderHandler.execute).not.toHaveBeenCalled();
      });
   });
});
