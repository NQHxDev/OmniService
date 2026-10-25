import { Test, TestingModule } from '@nestjs/testing';
import { OutboxService } from '@user/outbox/outbox.service';
import { OUTBOX_REPOSITORY } from '@user/outbox/repositories';

describe('User OutboxService', () => {
   let service: OutboxService;
   let mockOutboxRepository: {
      create: jest.Mock;
   };

   beforeEach(async () => {
      mockOutboxRepository = {
         create: jest.fn(),
      };

      const module: TestingModule = await Test.createTestingModule({
         providers: [
            OutboxService,
            {
               provide: OUTBOX_REPOSITORY,
               useValue: mockOutboxRepository,
            },
         ],
      }).compile();

      service = module.get<OutboxService>(OutboxService);
   });

   it('should delegate createOutboxEvent to outboxRepository.create', async () => {
      const mockResult = {
         eventId: 'evt-user-1',
         aggregateId: 'usr-1',
         aggregateType: 'user',
         eventType: 'UserProfileCreatedEvent',
         payload: { username: 'testuser' },
         createdAt: new Date(),
      };
      mockOutboxRepository.create.mockResolvedValue(mockResult);

      const result = await service.createOutboxEvent('usr-1', 'user', 'UserProfileCreatedEvent', {
         username: 'testuser',
      });

      expect(mockOutboxRepository.create).toHaveBeenCalledWith(
         {
            aggregateId: 'usr-1',
            aggregateType: 'user',
            eventType: 'UserProfileCreatedEvent',
            payload: { username: 'testuser' },
         },
         undefined,
      );
      expect(result).toEqual(mockResult);
   });
});
