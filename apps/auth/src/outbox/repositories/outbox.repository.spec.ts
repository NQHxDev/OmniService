import { Test, TestingModule } from '@nestjs/testing';
import { AUTH_AGGREGATES } from '@contracts/auth';
import { NOTIFICATION_EVENTS } from '@contracts/notification';
import { PrismaService } from '@auth/prisma/prisma.service';
import { OutboxRepository } from '@auth/outbox/repositories/outbox.repository';

describe('OutboxRepository', () => {
   let repository: OutboxRepository;
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
            OutboxRepository,
            {
               provide: PrismaService,
               useValue: prismaService,
            },
         ],
      }).compile();

      repository = module.get<OutboxRepository>(OutboxRepository);
   });

   it('should be defined', () => {
      expect(repository).toBeDefined();
   });

   it('should create an append-only outbox event', async () => {
      const now = new Date();
      prismaService.outboxEvent.create.mockResolvedValue({
         eventId: '018f6709-1234-7123-8123-0123456789ab',
         aggregateType: AUTH_AGGREGATES.ACCOUNT,
         aggregateId: 'user-1',
         eventType: NOTIFICATION_EVENTS.USER_REGISTERED,
         payload: { email: 'test@example.com' },
         createdAt: now,
      });

      const result = await repository.create({
         aggregateType: AUTH_AGGREGATES.ACCOUNT,
         aggregateId: 'user-1',
         eventType: NOTIFICATION_EVENTS.USER_REGISTERED,
         payload: { email: 'test@example.com' },
      });

      expect(result).toBeDefined();
      expect(result.eventId).toBe('018f6709-1234-7123-8123-0123456789ab');
      expect(result.aggregateType).toBe(AUTH_AGGREGATES.ACCOUNT);
      expect(result.aggregateId).toBe('user-1');
      expect(result.eventType).toBe(NOTIFICATION_EVENTS.USER_REGISTERED);
      expect(result.payload).toEqual({ email: 'test@example.com' });
      expect(result.createdAt).toBe(now.toISOString());
      expect(prismaService.outboxEvent.create).toHaveBeenCalled();
   });
});
