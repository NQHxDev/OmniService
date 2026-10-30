import { BadRequestException, ForbiddenException, NotFoundException } from '@common';
import { ORDER_STATUS } from '@contracts/order';
import { UpdateSupplierOrderStatusCommandHandler } from '@order/commands/update-supplier-order-status.command';
import { OrderStateMachine } from '@order/services/order-state-machine.service';
import type { PrismaService } from '@order/prisma/prisma.service';
import type { OrderMetricsService } from '@order/services/order-metrics.service';
import type { IOrderUnitOfWork } from '@order/unit-of-work';

describe('UpdateSupplierOrderStatusCommandHandler', () => {
   let handler: UpdateSupplierOrderStatusCommandHandler;
   let prisma: {
      order: { findUnique: jest.Mock };
      outboxEvent: { create: jest.Mock };
   };
   let mockOrderRepository: {
      updateSupplierOrderStatus: jest.Mock;
   };
   let uow: IOrderUnitOfWork;
   let metricsService: { recordOrderEvent: jest.Mock };
   let stateMachine: OrderStateMachine;

   const sampleOrder = {
      orderId: 'order-uuid-1',
      supplierId: 'supplier-uuid-1',
      userId: 'user-uuid-1',
      orderNumber: 'ORD-12345',
      orderStatus: ORDER_STATUS.CONFIRMED,
      paymentMethod: 'COD',
      paymentStatus: 'PENDING',
      updatedAt: new Date('2026-10-30T10:00:00Z'),
      items: [],
   };

   beforeEach(() => {
      mockOrderRepository = {
         updateSupplierOrderStatus: jest.fn(),
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
         ) as unknown as IOrderUnitOfWork['runInTransaction'],
      };

      metricsService = {
         recordOrderEvent: jest.fn(),
      };

      stateMachine = new OrderStateMachine();

      handler = new UpdateSupplierOrderStatusCommandHandler(
         uow,
         prisma as unknown as PrismaService,
         metricsService as unknown as OrderMetricsService,
         stateMachine,
      );
   });

   it('should successfully transition order from CONFIRMED to SHIPPING', async () => {
      prisma.order.findUnique.mockResolvedValue(sampleOrder);
      const updatedOrder = {
         ...sampleOrder,
         orderStatus: ORDER_STATUS.SHIPPING,
         updatedAt: new Date('2026-10-30T11:00:00Z'),
      };
      mockOrderRepository.updateSupplierOrderStatus.mockResolvedValue(updatedOrder);
      prisma.outboxEvent.create.mockResolvedValue({});

      const result = await handler.execute({
         orderId: sampleOrder.orderId,
         supplierId: sampleOrder.supplierId,
         status: ORDER_STATUS.SHIPPING,
         shipperTrackingCode: 'GHN-128391823',
         reason: '',
      });

      expect(result.status).toBe(ORDER_STATUS.SHIPPING);
      expect(mockOrderRepository.updateSupplierOrderStatus).toHaveBeenCalledWith({
         orderId: sampleOrder.orderId,
         status: ORDER_STATUS.SHIPPING,
         description: expect.any(String),
         shipperTrackingCode: 'GHN-128391823',
         cancelReason: undefined,
      });
      expect(prisma.outboxEvent.create).toHaveBeenCalled();
      expect(metricsService.recordOrderEvent).toHaveBeenCalledWith(ORDER_STATUS.SHIPPING, sampleOrder.paymentMethod);
   });

   it('should successfully transition order from CONFIRMED to PROCESSING', async () => {
      prisma.order.findUnique.mockResolvedValue(sampleOrder);
      const updatedOrder = {
         ...sampleOrder,
         orderStatus: ORDER_STATUS.PROCESSING,
         updatedAt: new Date('2026-10-30T10:30:00Z'),
      };
      mockOrderRepository.updateSupplierOrderStatus.mockResolvedValue(updatedOrder);
      prisma.outboxEvent.create.mockResolvedValue({});

      const result = await handler.execute({
         orderId: sampleOrder.orderId,
         supplierId: sampleOrder.supplierId,
         status: ORDER_STATUS.PROCESSING,
         reason: 'Merchant preparing items',
      });

      expect(result.status).toBe(ORDER_STATUS.PROCESSING);
   });

   it('should throw BadRequestException when orderId is missing or empty', async () => {
      await expect(
         handler.execute({
            orderId: '',
            supplierId: sampleOrder.supplierId,
            status: ORDER_STATUS.SHIPPING,
         }),
      ).rejects.toThrow(BadRequestException);
   });

   it('should throw BadRequestException when supplierId is missing or empty', async () => {
      await expect(
         handler.execute({
            orderId: sampleOrder.orderId,
            supplierId: '',
            status: ORDER_STATUS.SHIPPING,
         }),
      ).rejects.toThrow(BadRequestException);
   });

   it('should throw NotFoundException when order does not exist', async () => {
      prisma.order.findUnique.mockResolvedValue(null);

      await expect(
         handler.execute({
            orderId: 'non-existent-order',
            supplierId: sampleOrder.supplierId,
            status: ORDER_STATUS.SHIPPING,
         }),
      ).rejects.toThrow(NotFoundException);
   });

   it('should throw ForbiddenException when order belongs to a different supplier', async () => {
      prisma.order.findUnique.mockResolvedValue({
         ...sampleOrder,
         supplierId: 'different-supplier-uuid',
      });

      await expect(
         handler.execute({
            orderId: sampleOrder.orderId,
            supplierId: sampleOrder.supplierId,
            status: ORDER_STATUS.SHIPPING,
         }),
      ).rejects.toThrow(ForbiddenException);
   });

   it('should throw BadRequestException when status transition is invalid', async () => {
      prisma.order.findUnique.mockResolvedValue({
         ...sampleOrder,
         orderStatus: ORDER_STATUS.COMPLETED,
      });

      await expect(
         handler.execute({
            orderId: sampleOrder.orderId,
            supplierId: sampleOrder.supplierId,
            status: ORDER_STATUS.SHIPPING,
         }),
      ).rejects.toThrow(BadRequestException);
   });
});
