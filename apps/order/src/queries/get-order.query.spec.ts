import { status as GrpcStatus } from '@grpc/grpc-js';
import { RpcException } from '@nestjs/microservices';
import { COMMON_ERROR_CODES, createGrpcMetadata, DEFAULT_ROLES } from '@common';
import { ORDER_ERROR_CODES } from '@contracts/order';
import { Prisma } from '@order/prisma-client';
import type { PrismaService } from '@order/prisma/prisma.service';
import type { OrderWithItems } from '@order/entities';
import { GetOrderByIdQueryHandler, GetOrdersByUserIdQueryHandler } from '@order/queries/get-order.query';

describe('Order Queries - BOLA / IDOR Prevention', () => {
   let prisma: {
      order: {
         findUnique: jest.Mock;
         findMany: jest.Mock;
         count: jest.Mock;
      };
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
      prisma = {
         order: {
            findUnique: jest.fn(),
            findMany: jest.fn(),
            count: jest.fn(),
         },
      };
   });

   describe('GetOrderByIdQueryHandler', () => {
      let handler: GetOrderByIdQueryHandler;

      beforeEach(() => {
         handler = new GetOrderByIdQueryHandler(prisma as unknown as PrismaService);
      });

      it('should allow order retrieval when caller is the order owner', async () => {
         prisma.order.findUnique.mockResolvedValue(sampleOrder);

         const result = await handler.execute({
            orderId: sampleOrder.orderId,
            userId: 'owner-uuid',
         });

         expect(result).toEqual(sampleOrder);
         expect(prisma.order.findUnique).toHaveBeenCalledWith({
            where: { orderId: sampleOrder.orderId },
            include: { items: true },
         });
      });

      it('should allow order retrieval when caller is an admin', async () => {
         prisma.order.findUnique.mockResolvedValue(sampleOrder);

         const adminMetadata = createGrpcMetadata({
            userId: 'admin-uuid',
            roles: [DEFAULT_ROLES.ADMIN],
         });

         const result = await handler.execute(
            {
               orderId: sampleOrder.orderId,
               userId: 'admin-uuid',
            },
            adminMetadata,
         );

         expect(result).toEqual(sampleOrder);
      });

      it('should throw RpcException PERMISSION_DENIED when caller is not the order owner and not admin (BOLA attempt)', async () => {
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
      });

      it('should throw RpcException UNAUTHENTICATED when userId is omitted or empty (preventing BOLA bypass)', async () => {
         try {
            await handler.execute({
               orderId: sampleOrder.orderId,
               userId: '',
            });
            fail('Expected handler.execute to throw RpcException');
         } catch (error) {
            expect(error).toBeInstanceOf(RpcException);
            const rpcError = (error as RpcException).getError() as { code: number; message: string };
            expect(rpcError.code).toBe(GrpcStatus.UNAUTHENTICATED);
            expect(rpcError.message).toBe(COMMON_ERROR_CODES.UNAUTHORIZED);
         }

         expect(prisma.order.findUnique).not.toHaveBeenCalled();
      });

      it('should throw RpcException NOT_FOUND when order does not exist', async () => {
         prisma.order.findUnique.mockResolvedValue(null);

         try {
            await handler.execute({
               orderId: 'non-existent-order',
               userId: 'user-uuid',
            });
            fail('Expected handler.execute to throw RpcException');
         } catch (error) {
            expect(error).toBeInstanceOf(RpcException);
            const rpcError = (error as RpcException).getError() as { code: number; message: string };
            expect(rpcError.code).toBe(GrpcStatus.NOT_FOUND);
            expect(rpcError.message).toBe(ORDER_ERROR_CODES.NOT_FOUND);
         }
      });
   });

   describe('GetOrdersByUserIdQueryHandler', () => {
      let handler: GetOrdersByUserIdQueryHandler;

      beforeEach(() => {
         handler = new GetOrdersByUserIdQueryHandler(prisma as unknown as PrismaService);
      });

      it('should return paginated orders for a valid userId', async () => {
         prisma.order.findMany.mockResolvedValue([sampleOrder]);
         prisma.order.count.mockResolvedValue(1);

         const result = await handler.execute({
            userId: 'owner-uuid',
            page: 1,
            limit: 10,
         });

         expect(result.orders).toEqual([sampleOrder]);
         expect(result.total).toBe(1);
         expect(result.page).toBe(1);
         expect(result.limit).toBe(10);
      });

      it('should throw RpcException UNAUTHENTICATED when userId is missing', async () => {
         try {
            await handler.execute({
               userId: '',
            });
            fail('Expected handler.execute to throw RpcException');
         } catch (error) {
            expect(error).toBeInstanceOf(RpcException);
            const rpcError = (error as RpcException).getError() as { code: number; message: string };
            expect(rpcError.code).toBe(GrpcStatus.UNAUTHENTICATED);
            expect(rpcError.message).toBe(COMMON_ERROR_CODES.UNAUTHORIZED);
         }

         expect(prisma.order.findMany).not.toHaveBeenCalled();
      });
   });
});
