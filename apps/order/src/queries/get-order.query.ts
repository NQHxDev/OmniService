import { Injectable, Logger } from '@nestjs/common';
import { status as GrpcStatus } from '@grpc/grpc-js';
import { RpcException } from '@nestjs/microservices';
import { PrismaService } from '@order/prisma/prisma.service';
import type { IGetOrderByIdRequest, IGetOrdersByUserIdRequest } from '@contracts/order';
import { ORDER_ERROR_CODES } from '@contracts/order';
import type { OrderWithItems } from '@order/entities';
import { assertOrderOwnershipOrAdmin, validateOrderUserId } from '@order/utils';

@Injectable()
export class GetOrderByIdQueryHandler {
   private readonly logger = new Logger(GetOrderByIdQueryHandler.name);

   constructor(private readonly prisma: PrismaService) {}

   async execute(dto: IGetOrderByIdRequest, contextOrMetadata?: unknown): Promise<OrderWithItems> {
      validateOrderUserId(dto.userId);

      const order = await this.prisma.order.findUnique({
         where: { orderId: dto.orderId },
         include: { items: true },
      });

      if (!order) {
         throw new RpcException({
            code: GrpcStatus.NOT_FOUND, // 5
            message: ORDER_ERROR_CODES.NOT_FOUND,
         });
      }

      assertOrderOwnershipOrAdmin(order.userId, dto.userId, contextOrMetadata);

      return order;
   }
}

@Injectable()
export class GetOrdersByUserIdQueryHandler {
   private readonly logger = new Logger(GetOrdersByUserIdQueryHandler.name);

   constructor(private readonly prisma: PrismaService) {}

   async execute(
      dto: IGetOrdersByUserIdRequest,
      _contextOrMetadata?: unknown,
   ): Promise<{
      orders: OrderWithItems[];
      total: number;
      page: number;
      limit: number;
   }> {
      validateOrderUserId(dto.userId);

      const page = Math.max(1, Number(dto.page) || 1);
      const limit = Math.max(1, Math.min(100, Number(dto.limit) || 20));
      const skip = (page - 1) * limit;

      const [orders, total] = await Promise.all([
         this.prisma.order.findMany({
            where: { userId: dto.userId },
            include: { items: true },
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
         }),
         this.prisma.order.count({
            where: { userId: dto.userId },
         }),
      ]);

      return {
         orders,
         total,
         page,
         limit,
      };
   }
}
