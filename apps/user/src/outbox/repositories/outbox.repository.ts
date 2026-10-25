import { Inject, Injectable } from '@nestjs/common';
import { uuidv7 } from '@common';
import { PrismaService, type PrismaClientOrTransaction } from '@user/prisma';
import type { OutboxEvent, Prisma } from '@user/prisma-client';
import type { CreateOutboxEventData, IOutboxRepository } from '@user/outbox/repositories/outbox.repository.interface';

@Injectable()
export class OutboxRepository implements IOutboxRepository {
   constructor(@Inject(PrismaService) private readonly prisma: PrismaClientOrTransaction) {}

   async create(data: CreateOutboxEventData, tx?: Prisma.TransactionClient): Promise<OutboxEvent> {
      const client = tx ?? this.prisma;
      return client.outboxEvent.create({
         data: {
            eventId: data.eventId ?? uuidv7(),
            aggregateId: data.aggregateId,
            aggregateType: data.aggregateType,
            eventType: data.eventType,
            payload: data.payload as Prisma.InputJsonValue,
         },
      });
   }
}
