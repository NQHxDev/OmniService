import { Inject, Injectable, Logger } from '@nestjs/common';
import { BadRequestException, ForbiddenException, NotFoundException } from '@common';
import { ORDER_UNIT_OF_WORK, type IOrderUnitOfWork } from '@order/unit-of-work';
import { PrismaService } from '@order/prisma/prisma.service';
import {
   ORDER_AGGREGATE_TYPE,
   ORDER_ERROR_CODES,
   ORDER_EVENTS,
   ORDER_STATUS,
   type IUpdateSupplierOrderStatusRequest,
   type IUpdateSupplierOrderStatusResponse,
   type OrderStatus,
} from '@contracts/order';
import { OrderMetricsService } from '@order/services/order-metrics.service';
import { OrderStateMachine } from '@order/services/order-state-machine.service';

@Injectable()
export class UpdateSupplierOrderStatusCommandHandler {
   private readonly logger = new Logger(UpdateSupplierOrderStatusCommandHandler.name);

   constructor(
      @Inject(ORDER_UNIT_OF_WORK) private readonly uow: IOrderUnitOfWork,
      private readonly prisma: PrismaService,
      private readonly metricsService: OrderMetricsService,
      private readonly stateMachine: OrderStateMachine,
   ) {}

   async execute(dto: IUpdateSupplierOrderStatusRequest): Promise<IUpdateSupplierOrderStatusResponse> {
      if (!dto.orderId || dto.orderId.trim().length === 0) {
         throw new BadRequestException(ORDER_ERROR_CODES.ORDER_ID_REQUIRED);
      }

      if (!dto.supplierId || dto.supplierId.trim().length === 0) {
         throw new BadRequestException(ORDER_ERROR_CODES.SUPPLIER_ID_REQUIRED);
      }

      const existing = await this.prisma.order.findUnique({
         where: { orderId: dto.orderId },
         include: { items: true },
      });

      if (!existing) {
         throw new NotFoundException(ORDER_ERROR_CODES.NOT_FOUND);
      }

      if (existing.supplierId && existing.supplierId !== dto.supplierId) {
         throw new ForbiddenException(ORDER_ERROR_CODES.FORBIDDEN_SUPPLIER_ORDER);
      }

      const previousStatus = existing.orderStatus;
      const targetStatus = dto.status as OrderStatus;

      const transitionValidation = this.stateMachine.validateTransition(previousStatus, targetStatus);
      if (!transitionValidation.isValid) {
         throw new BadRequestException(transitionValidation.errorCode || ORDER_ERROR_CODES.INVALID_STATUS_TRANSITION, {
            params: transitionValidation.params,
         });
      }

      const timelineDescription =
         dto.reason && dto.reason.trim().length > 0
            ? dto.reason.trim()
            : this.stateMachine.getTimelineKey(targetStatus);

      const updated = await this.uow.runInTransaction(async (repos) => {
         const order = await repos.orderRepository.updateSupplierOrderStatus({
            orderId: dto.orderId,
            status: targetStatus,
            description: timelineDescription,
            shipperTrackingCode: dto.shipperTrackingCode,
            cancelReason: targetStatus === ORDER_STATUS.CANCELLED ? dto.reason : undefined,
         });

         await this.prisma.outboxEvent.create({
            data: {
               aggregateType: ORDER_AGGREGATE_TYPE,
               aggregateId: order.orderId,
               eventType: ORDER_EVENTS.ORDER_STATUS_CHANGED,
               payload: {
                  orderId: order.orderId,
                  supplierId: order.supplierId,
                  userId: order.userId,
                  orderNumber: order.orderNumber,
                  previousStatus,
                  currentStatus: targetStatus,
                  shipperTrackingCode: dto.shipperTrackingCode,
                  reason: dto.reason,
                  updatedAt: new Date().toISOString(),
               },
            },
         });

         return order;
      });

      this.metricsService.recordOrderEvent(targetStatus, updated.paymentMethod);
      this.logger.log(
         `Supplier ${dto.supplierId} changed order ${updated.orderNumber} status from ${previousStatus} to ${targetStatus}`,
      );

      return {
         orderId: updated.orderId,
         status: updated.orderStatus,
         updatedAt: updated.updatedAt.toISOString(),
      };
   }
}
