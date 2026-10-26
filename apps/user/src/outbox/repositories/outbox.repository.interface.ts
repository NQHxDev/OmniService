import type { OutboxEvent, Prisma } from '@user/prisma-client';

export const OUTBOX_REPOSITORY = Symbol('OUTBOX_REPOSITORY');

export interface CreateOutboxEventData {
   aggregateId: string;
   aggregateType: string;
   eventType: string;
   payload: Record<string, unknown>;
   eventId?: string;
}

export interface IOutboxRepository {
   create(data: CreateOutboxEventData, tx?: Prisma.TransactionClient): Promise<OutboxEvent>;
}
