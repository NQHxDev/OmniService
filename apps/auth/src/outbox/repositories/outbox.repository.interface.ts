import type { CreateOutboxEventData, OutboxEventEntity } from '@auth/outbox/entities/outbox-event.entity';
import type { Prisma } from '@auth/prisma-client';

export const OUTBOX_REPOSITORY = Symbol('OUTBOX_REPOSITORY');

export interface IOutboxRepository {
   create(data: CreateOutboxEventData, tx?: Prisma.TransactionClient): Promise<OutboxEventEntity>;
   deleteByAggregateId(aggregateId: string): Promise<void>;
}
