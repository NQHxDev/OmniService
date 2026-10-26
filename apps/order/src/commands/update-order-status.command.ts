import { Inject, Injectable, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { ORDER_UNIT_OF_WORK, type IOrderUnitOfWork } from '@order/unit-of-work';
import { PrismaService } from '@order/prisma/prisma.service';
import type { IUpdateOrderStatusRequest } from '@contracts/order';
import { ORDER_EVENTS, ORDER_ERROR_CODES } from '@contracts/order';
import type { OrderWithItems } from '@order/entities';
import type { OrderStatusEnum } from '@order/prisma-client';
import { OrderMetricsService } from '@order/services/order-metrics.service';

@Injectable()
export class UpdateOrderStatusCommandHandler {
   private readonly logger = new Logger(UpdateOrderStatusCommandHandler.name);

   constructor(
      @Inject(ORDER_UNIT_OF_WORK) private readonly uow: IOrderUnitOfWork,
      private readonly prisma: PrismaService,
      private readonly metricsService: OrderMetricsService,
   ) {}

   async execute(dto: IUpdateOrderStatusRequest): Promise<OrderWithItems> {
      const existing = await this.prisma.order.findUnique({
         where: { orderId: dto.orderId },
         include: { items: true },
      });

      if (!existing) {
         throw new RpcException({
            code: 5,
            message: ORDER_ERROR_CODES.NOT_FOUND,
         });
      }

      const previousStatus = existing.orderStatus;
      const newStatus = dto.status as OrderStatusEnum;

      const updated = await this.uow.runInTransaction(async (repos) => {
         const order = await repos.orderRepository.updateStatus(dto.orderId, newStatus);

         await this.prisma.outboxEvent.create({
            data: {
               aggregateType: 'Order',
               aggregateId: order.orderId,
               eventType: ORDER_EVENTS.ORDER_STATUS_CHANGED,
               payload: {
                  orderId: order.orderId,
                  userId: order.userId,
                  orderNumber: order.orderNumber,
                  previousStatus,
                  currentStatus: newStatus,
                  updatedAt: new Date().toISOString(),
               },
            },
         });

         return order;
      });

      this.metricsService.recordOrderEvent(newStatus, updated.paymentMethod);
      this.logger.log(`Order ${updated.orderNumber} status changed from ${previousStatus} to ${newStatus}`);

      return updated;
   }
}
