import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@commerce/prisma';
import { OutboxService } from '@commerce/outbox/outbox.service';

describe('Commerce OutboxService', () => {
   let service: OutboxService;
   let prismaService: {
      outboxEvent: {
         create: jest.Mock;
      };
   };

   beforeEach(async () => {
      prismaService = {
         outboxEvent: {
            create: jest.fn(),
         },
      };

      const module: TestingModule = await Test.createTestingModule({
         providers: [
            OutboxService,
            {
               provide: PrismaService,
               useValue: prismaService,
            },
         ],
      }).compile();

      service = module.get<OutboxService>(OutboxService);
   });

   it('should emit append-only outbox event with positional arguments', async () => {
      const mockEvent = {
         eventId: 'evt-com-1',
         aggregateId: 'prod-123',
         aggregateType: 'product',
         eventType: 'ProductCreatedEvent',
         payload: { title: 'Arabica Coffee' },
         createdAt: new Date(),
      };
      prismaService.outboxEvent.create.mockResolvedValue(mockEvent);

      const result = await service.emitEvent('prod-123', 'product', 'ProductCreatedEvent', { title: 'Arabica Coffee' });

      expect(prismaService.outboxEvent.create).toHaveBeenCalledWith({
         data: expect.objectContaining({
            aggregateId: 'prod-123',
            aggregateType: 'product',
            eventType: 'ProductCreatedEvent',
            payload: { title: 'Arabica Coffee' },
         }) as unknown,
      });
      expect(result).toEqual(mockEvent);
   });

   it('should emit event with options object and explicit transaction client', async () => {
      const mockTx = {
         outboxEvent: {
            create: jest.fn().mockResolvedValue({ eventId: 'evt-tx-1' }),
         },
      };

      await service.emitEvent({
         aggregateId: 'prod-456',
         aggregateType: 'product',
         eventType: 'ProductPriceUpdatedEvent',
         payload: { price: 50000 },
         tx: mockTx as any,
      });

      expect(mockTx.outboxEvent.create).toHaveBeenCalled();
      expect(prismaService.outboxEvent.create).not.toHaveBeenCalled();
   });
});
