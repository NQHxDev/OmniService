import { Inject, Injectable, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { ORDER_UNIT_OF_WORK, type IOrderUnitOfWork } from '@order/unit-of-work';
import { PrismaService } from '@order/prisma/prisma.service';
import type { ICancelOrderRequest } from '@contracts/order';
import type { OrderWithItems } from '@order/entities';
import { ORDER_EVENTS } from '@contracts/order';
import { OrderMetricsService } from '@order/services/order-metrics.service';

@Injectable()
export class CancelOrderCommandHandler {
   private readonly logger = new Logger(CancelOrderCommandHandler.name);

   constructor(
      @Inject(ORDER_UNIT_OF_WORK) private readonly uow: IOrderUnitOfWork,
      private readonly prisma: PrismaService,
      private readonly metricsService: OrderMetricsService,
   ) {}

   async execute(dto: ICancelOrderRequest): Promise<OrderWithItems> {
      const existing = await this.prisma.order.findUnique({
         where: { orderId: dto.orderId },
         include: { items: true },
      });

      if (!existing) {
         throw new RpcException({
            code: 5, // NOT_FOUND
            message: 'ORDER.NOT_FOUND',
         });
      }

      if (dto.userId && existing.userId !== dto.userId) {
         throw new RpcException({
            code: 7, // PERMISSION_DENIED
            message: 'ORDER.UNAUTHORIZED_ACCESS',
         });
      }

      if (['SHIPPING', 'DELIVERED', 'COMPLETED', 'CANCELLED'].includes(existing.orderStatus)) {
         throw new RpcException({
            code: 9, // FAILED_PRECONDITION
            message: 'ORDER.CANNOT_CANCEL_IN_CURRENT_STATE',
         });
      }

      const cancelledOrder = await this.uow.runInTransaction(async (repos) => {
         const order = await repos.orderRepository.cancel(dto.orderId, dto.reason);

         await this.prisma.outboxEvent.create({
            data: {
               aggregateType: 'Order',
               aggregateId: order.orderId,
               eventType: ORDER_EVENTS.ORDER_CANCELLED,
               payload: {
                  orderId: order.orderId,
                  userId: order.userId,
                  orderNumber: order.orderNumber,
                  reason: dto.reason,
                  cancelledAt: new Date().toISOString(),
               },
            },
         });

         return order;
      });

      this.metricsService.recordOrderEvent('CANCELLED', cancelledOrder.paymentMethod);
      this.logger.log(`Order ${cancelledOrder.orderNumber} cancelled by user ${cancelledOrder.userId}`);

      return cancelledOrder;
   }
}
