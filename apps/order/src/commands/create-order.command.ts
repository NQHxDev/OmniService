import { Inject, Injectable, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { ORDER_UNIT_OF_WORK, type IOrderUnitOfWork } from '@order/unit-of-work';
import { PrismaService } from '@order/prisma/prisma.service';
import type { ICreateOrderRequest } from '@contracts/order';
import { ORDER_EVENTS, ORDER_ERROR_CODES } from '@contracts/order';
import type { OrderWithItems } from '@order/entities';
import { OrderMetricsService } from '@order/services/order-metrics.service';
import type { OrderStatusEnum, PaymentMethodEnum, PaymentStatusEnum } from '@order/prisma-client';
import { validateOrderUserId } from '@order/utils';

@Injectable()
export class CreateOrderCommandHandler {
   private readonly logger = new Logger(CreateOrderCommandHandler.name);

   constructor(
      @Inject(ORDER_UNIT_OF_WORK) private readonly uow: IOrderUnitOfWork,
      private readonly prisma: PrismaService,
      private readonly metricsService: OrderMetricsService,
   ) {}

   async execute(dto: ICreateOrderRequest): Promise<OrderWithItems> {
      validateOrderUserId(dto.userId);

      if (!dto.items || dto.items.length === 0) {
         throw new RpcException({
            code: 3, // INVALID_ARGUMENT
            message: ORDER_ERROR_CODES.ITEMS_REQUIRED,
         });
      }

      // Calculate totals
      let calculatedTotal = 0;
      const orderItems = dto.items.map((item) => {
         const itemTotal = Number(item.quantity) * Number(item.unitPrice);
         calculatedTotal += itemTotal;
         return {
            productId: item.productId,
            productName: item.productName,
            quantity: Number(item.quantity),
            unitPrice: Number(item.unitPrice),
            totalPrice: itemTotal,
         };
      });

      const shippingFee = Number(dto.shippingFee || 0);
      calculatedTotal += shippingFee;

      const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const orderStatus: OrderStatusEnum = dto.paymentMethod === 'COD' ? 'CONFIRMED' : 'AWAITING_PAYMENT';
      const paymentStatus: PaymentStatusEnum = 'PENDING';

      const order = await this.uow.runInTransaction(async (repos) => {
         const createdOrder = await repos.orderRepository.create({
            userId: dto.userId,
            orderNumber,
            orderStatus,
            paymentMethod: dto.paymentMethod as PaymentMethodEnum,
            paymentStatus,
            totalAmount: calculatedTotal,
            shippingFee,
            shippingAddress: dto.shippingAddress,
            receiverName: dto.receiverName,
            receiverPhone: dto.receiverPhone,
            note: dto.note,
            items: orderItems,
         });

         // Record outbox event for choreography saga
         await this.prisma.outboxEvent.create({
            data: {
               aggregateType: 'Order',
               aggregateId: createdOrder.orderId,
               eventType: ORDER_EVENTS.ORDER_CREATED,
               payload: {
                  orderId: createdOrder.orderId,
                  userId: createdOrder.userId,
                  orderNumber: createdOrder.orderNumber,
                  totalAmount: Number(createdOrder.totalAmount),
                  paymentMethod: createdOrder.paymentMethod,
                  paymentStatus: createdOrder.paymentStatus,
                  shippingFee: Number(createdOrder.shippingFee),
                  items: createdOrder.items.map((i) => ({
                     productId: i.productId,
                     productName: i.productName,
                     quantity: i.quantity,
                     unitPrice: Number(i.unitPrice),
                     totalPrice: Number(i.totalPrice),
                  })),
               },
            },
         });

         return createdOrder;
      });

      this.metricsService.recordOrderEvent(order.orderStatus, order.paymentMethod);
      this.logger.log(`Created order ${order.orderNumber} (ID: ${order.orderId}) for user ${order.userId}`);

      return order;
   }
}
