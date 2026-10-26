import { Inject, Injectable } from '@nestjs/common';
import { uuidv7 } from '@common';
import { PrismaService, type PrismaClientOrTransaction } from '@auth/prisma';
import type { CreateOutboxEventData, OutboxEventEntity } from '@auth/outbox/entities/outbox-event.entity';
import type { IOutboxRepository } from '@auth/outbox/repositories/outbox.repository.interface';
import { type OutboxEvent, type Prisma } from '@auth/prisma-client';

@Injectable()
export class OutboxRepository implements IOutboxRepository {
   constructor(@Inject(PrismaService) private readonly prisma: PrismaClientOrTransaction) {}

   private toEntity(event: OutboxEvent): OutboxEventEntity {
      return {
         eventId: event.eventId,
         aggregateType: event.aggregateType,
         aggregateId: event.aggregateId,
         eventType: event.eventType,
         payload: event.payload as Record<string, unknown>,
         createdAt: event.createdAt.toISOString(),
      };
   }

   async create(data: CreateOutboxEventData, tx?: Prisma.TransactionClient): Promise<OutboxEventEntity> {
      const client = tx || this.prisma;
      const id = data.eventId || uuidv7();
      const event = await client.outboxEvent.create({
         data: {
            eventId: id,
            aggregateType: data.aggregateType,
            aggregateId: data.aggregateId || id,
            eventType: data.eventType,
            payload: data.payload as Prisma.InputJsonValue,
         },
      });

      return this.toEntity(event);
   }

   async deleteByAggregateId(aggregateId: string): Promise<void> {
      await this.prisma.outboxEvent.deleteMany({
         where: { aggregateId },
      });
   }
}
