import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@supplier/prisma';
import { OutboxService } from '@supplier/outbox/outbox.service';

describe('Supplier OutboxService', () => {
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
         eventId: 'evt-sup-1',
         aggregateId: 'sup-123',
         aggregateType: 'supplier',
         eventType: 'SupplierProfileApprovedEvent',
         payload: { supplierName: 'Organic Valley' },
         createdAt: new Date(),
      };
      prismaService.outboxEvent.create.mockResolvedValue(mockEvent);

      const result = await service.emitEvent('sup-123', 'supplier', 'SupplierProfileApprovedEvent', {
         supplierName: 'Organic Valley',
      });

      expect(prismaService.outboxEvent.create).toHaveBeenCalledWith({
         data: expect.objectContaining({
            aggregateId: 'sup-123',
            aggregateType: 'supplier',
            eventType: 'SupplierProfileApprovedEvent',
            payload: { supplierName: 'Organic Valley' },
         }) as unknown,
      });
      expect(result).toEqual(mockEvent);
   });

   it('should emit event with options object and explicit transaction client', async () => {
      const mockTx = {
         outboxEvent: {
            create: jest.fn().mockResolvedValue({ eventId: 'evt-sup-tx-1' }),
         },
      };

      await service.emitEvent({
         aggregateId: 'sup-789',
         aggregateType: 'supplier',
         eventType: 'SupplierSuspendedEvent',
         payload: { reason: 'Policy violation' },
         tx: mockTx as any,
      });

      expect(mockTx.outboxEvent.create).toHaveBeenCalled();
      expect(prismaService.outboxEvent.create).not.toHaveBeenCalled();
   });
});
