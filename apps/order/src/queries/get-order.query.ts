import { Injectable, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { PrismaService } from '@order/prisma/prisma.service';
import type { IGetOrderByIdRequest, IGetOrdersByUserIdRequest } from '@contracts/order';
import type { OrderWithItems } from '@order/entities';

@Injectable()
export class GetOrderByIdQueryHandler {
   private readonly logger = new Logger(GetOrderByIdQueryHandler.name);

   constructor(private readonly prisma: PrismaService) {}

   async execute(dto: IGetOrderByIdRequest): Promise<OrderWithItems> {
      const order = await this.prisma.order.findUnique({
         where: { orderId: dto.orderId },
         include: { items: true },
      });

      if (!order) {
         throw new RpcException({
            code: 5, // NOT_FOUND
            message: 'ORDER.NOT_FOUND',
         });
      }

      if (dto.userId && order.userId !== dto.userId) {
         throw new RpcException({
            code: 7, // PERMISSION_DENIED
            message: 'ORDER.UNAUTHORIZED_ACCESS',
         });
      }

      return order;
   }
}

@Injectable()
export class GetOrdersByUserIdQueryHandler {
   private readonly logger = new Logger(GetOrdersByUserIdQueryHandler.name);

   constructor(private readonly prisma: PrismaService) {}

   async execute(dto: IGetOrdersByUserIdRequest): Promise<{
      orders: OrderWithItems[];
      total: number;
      page: number;
      limit: number;
   }> {
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
