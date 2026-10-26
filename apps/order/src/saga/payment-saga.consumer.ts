import { Controller, Logger } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import { QUEUES, RmqService } from '@common';
import { PAYMENT_EVENTS } from '@contracts/payment';
import { PrismaService } from '@order/prisma/prisma.service';
import { ORDER_EVENTS } from '@contracts/order';
import { OrderMetricsService } from '@order/services/order-metrics.service';

interface PaymentEventPayload {
   orderId: string;
   transactionId: string;
   userId?: string;
   amount?: number;
   paymentMethod?: string;
   reason?: string;
}

@Controller()
export class PaymentSagaConsumer {
   private readonly logger = new Logger(PaymentSagaConsumer.name);

   constructor(
      private readonly prisma: PrismaService,
      private readonly rmqService: RmqService,
      private readonly metricsService: OrderMetricsService,
   ) {}

   @EventPattern(PAYMENT_EVENTS.PAYMENT_SUCCEEDED)
   async handlePaymentSucceeded(@Payload() payload: PaymentEventPayload, @Ctx() context?: RmqContext): Promise<void> {
      try {
         this.logger.log(`Received PAYMENT_SUCCEEDED for order: ${payload.orderId}`);
         const order = await this.prisma.order.findUnique({
            where: { orderId: payload.orderId },
         });

         if (order) {
            await this.prisma.$transaction([
               this.prisma.order.update({
                  where: { orderId: payload.orderId },
                  data: {
                     paymentStatus: 'SUCCESS',
                     orderStatus: 'CONFIRMED',
                  },
               }),
               this.prisma.outboxEvent.create({
                  data: {
                     aggregateType: 'Order',
                     aggregateId: order.orderId,
                     eventType: ORDER_EVENTS.ORDER_STATUS_CHANGED,
                     payload: {
                        orderId: order.orderId,
                        orderNumber: order.orderNumber,
                        previousStatus: order.orderStatus,
                        currentStatus: 'CONFIRMED',
                        paymentStatus: 'SUCCESS',
                        transactionId: payload.transactionId,
                     },
                  },
               }),
            ]);
            this.metricsService.recordOrderEvent('CONFIRMED', order.paymentMethod);
         }

         if (context) {
            this.rmqService.ack(context);
         }
      } catch (error) {
         this.logger.error(`Failed to process PAYMENT_SUCCEEDED for order ${payload.orderId}`, error);
         if (context) {
            await this.rmqService.handleError(error, context, { queue: QUEUES.ORDER });
         }
         throw error;
      }
   }

   @EventPattern(PAYMENT_EVENTS.PAYMENT_FAILED)
   async handlePaymentFailed(@Payload() payload: PaymentEventPayload, @Ctx() context?: RmqContext): Promise<void> {
      try {
         this.logger.warn(`Received PAYMENT_FAILED for order: ${payload.orderId}, reason: ${payload.reason}`);
         const order = await this.prisma.order.findUnique({
            where: { orderId: payload.orderId },
         });

         if (order) {
            await this.prisma.$transaction([
               this.prisma.order.update({
                  where: { orderId: payload.orderId },
                  data: {
                     paymentStatus: 'FAILED',
                  },
               }),
               this.prisma.outboxEvent.create({
                  data: {
                     aggregateType: 'Order',
                     aggregateId: order.orderId,
                     eventType: ORDER_EVENTS.ORDER_STATUS_CHANGED,
                     payload: {
                        orderId: order.orderId,
                        orderNumber: order.orderNumber,
                        previousStatus: order.orderStatus,
                        currentStatus: order.orderStatus,
                        paymentStatus: 'FAILED',
                        reason: payload.reason,
                     },
                  },
               }),
            ]);
         }

         if (context) {
            this.rmqService.ack(context);
         }
      } catch (error) {
         this.logger.error(`Failed to process PAYMENT_FAILED for order ${payload.orderId}`, error);
         if (context) {
            await this.rmqService.handleError(error, context, { queue: QUEUES.ORDER });
         }
         throw error;
      }
   }

   @EventPattern(PAYMENT_EVENTS.PAYMENT_COD_PENDING)
   async handlePaymentCodPending(@Payload() payload: PaymentEventPayload, @Ctx() context?: RmqContext): Promise<void> {
      try {
         this.logger.log(`Received PAYMENT_COD_PENDING for order: ${payload.orderId}`);
         const order = await this.prisma.order.findUnique({
            where: { orderId: payload.orderId },
         });

         if (order) {
            await this.prisma.order.update({
               where: { orderId: payload.orderId },
               data: {
                  paymentStatus: 'PENDING',
                  orderStatus: 'CONFIRMED',
               },
            });
            this.metricsService.recordOrderEvent('CONFIRMED', order.paymentMethod);
         }

         if (context) {
            this.rmqService.ack(context);
         }
      } catch (error) {
         this.logger.error(`Failed to process PAYMENT_COD_PENDING for order ${payload.orderId}`, error);
         if (context) {
            await this.rmqService.handleError(error, context, { queue: QUEUES.ORDER });
         }
         throw error;
      }
   }

   @EventPattern(PAYMENT_EVENTS.PAYMENT_REFUNDED)
   async handlePaymentRefunded(@Payload() payload: PaymentEventPayload, @Ctx() context?: RmqContext): Promise<void> {
      try {
         this.logger.log(`Received PAYMENT_REFUNDED for order: ${payload.orderId}`);
         const order = await this.prisma.order.findUnique({
            where: { orderId: payload.orderId },
         });

         if (order) {
            await this.prisma.order.update({
               where: { orderId: payload.orderId },
               data: {
                  paymentStatus: 'REFUNDED',
                  orderStatus: 'REFUNDED',
               },
            });
            this.metricsService.recordOrderEvent('REFUNDED', order.paymentMethod);
         }

         if (context) {
            this.rmqService.ack(context);
         }
      } catch (error) {
         this.logger.error(`Failed to process PAYMENT_REFUNDED for order ${payload.orderId}`, error);
         if (context) {
            await this.rmqService.handleError(error, context, { queue: QUEUES.ORDER });
         }
         throw error;
      }
   }
}
