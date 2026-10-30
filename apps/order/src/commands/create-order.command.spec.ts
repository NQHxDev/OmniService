import { CreateOrderCommandHandler } from './create-order.command';
import type { IOrderUnitOfWork } from '@order/unit-of-work';
import type { PrismaService } from '@order/prisma/prisma.service';
import type { OrderMetricsService } from '@order/services/order-metrics.service';
import type { ICreateOrderRequest } from '@contracts/order';
import { RpcException } from '@nestjs/microservices';

describe('CreateOrderCommandHandler', () => {
   let handler: CreateOrderCommandHandler;
   let mockUow: jest.Mocked<IOrderUnitOfWork>;
   let mockPrisma: { outboxEvent: { create: jest.Mock } };
   let mockMetricsService: { recordOrderEvent: jest.Mock };
   let mockOrderRepository: { create: jest.Mock };

   beforeEach(() => {
      mockOrderRepository = {
         create: jest.fn(),
      };

      mockUow = {
         runInTransaction: jest.fn((callback) =>
            callback({
               orderRepository: mockOrderRepository as any,
               orderTimelineRepository: {} as any,
            }),
         ),
      };

      mockPrisma = {
         outboxEvent: {
            create: jest.fn().mockResolvedValue({}),
         },
      };

      mockMetricsService = {
         recordOrderEvent: jest.fn(),
      };

      handler = new CreateOrderCommandHandler(
         mockUow,
         mockPrisma as unknown as PrismaService,
         mockMetricsService as unknown as OrderMetricsService,
      );
   });

   it('should throw RpcException when items are missing or empty', async () => {
      const dto: ICreateOrderRequest = {
         userId: '01a18c12-d4ac-76e8-a999-f42f9e4df1e3',
         paymentMethod: 'COD',
         shippingAddress: '123 Nguyen Hue',
         receiverName: 'Alex',
         receiverPhone: '0901234567',
         items: [],
      };

      await expect(handler.execute(dto)).rejects.toThrow(RpcException);
   });

   it('should combine order note with item-level notes and create order successfully', async () => {
      const sampleCreatedOrder = {
         orderId: '01a18c7a-9167-766f-bebf-c6a1cdb1aea5',
         userId: '01a18c12-d4ac-76e8-a999-f42f9e4df1e3',
         orderNumber: 'ORD-TEST-1234',
         orderStatus: 'CONFIRMED',
         paymentMethod: 'COD',
         paymentStatus: 'PENDING',
         totalAmount: 95000,
         shippingFee: 15000,
         items: [
            {
               orderItemId: 'item-1',
               productId: 'prod-1',
               productName: 'Matcha Latte',
               quantity: 2,
               unitPrice: 40000,
               totalPrice: 80000,
               imageUrl: 'https://cdn.example.com/matcha.jpg',
            },
         ],
      };

      mockOrderRepository.create.mockResolvedValue(sampleCreatedOrder);

      const dto: ICreateOrderRequest = {
         userId: '01a18c12-d4ac-76e8-a999-f42f9e4df1e3',
         paymentMethod: 'COD',
         shippingAddress: '123 Nguyen Hue',
         receiverName: 'Alex',
         receiverPhone: '0901234567',
         note: 'Call before delivery',
         shippingFee: 15000,
         items: [
            {
               productId: 'prod-1',
               productName: 'Matcha Latte',
               quantity: 2,
               unitPrice: 40000,
               note: 'Less ice, less sugar',
               imageUrl: 'https://cdn.example.com/matcha.jpg',
            },
         ],
      };

      const result = await handler.execute(dto);

      expect(result).toEqual(sampleCreatedOrder);
      expect(mockOrderRepository.create).toHaveBeenCalledWith(
         expect.objectContaining({
            note: 'Call before delivery | [Item notes: Matcha Latte: Less ice, less sugar]',
            shippingFee: 15000,
            totalAmount: 95000,
            items: [
               expect.objectContaining({
                  productId: 'prod-1',
                  productName: 'Matcha Latte',
                  quantity: 2,
                  unitPrice: 40000,
                  totalPrice: 80000,
                  imageUrl: 'https://cdn.example.com/matcha.jpg',
               }),
            ],
         }),
      );
      expect(mockPrisma.outboxEvent.create).toHaveBeenCalled();
      expect(mockMetricsService.recordOrderEvent).toHaveBeenCalledWith('CONFIRMED', 'COD');
   });
});
