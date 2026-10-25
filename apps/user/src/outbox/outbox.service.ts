import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@user/prisma-client';
import { OUTBOX_REPOSITORY, type IOutboxRepository } from '@user/outbox/repositories';

@Injectable()
export class OutboxService {
   constructor(
      @Inject(OUTBOX_REPOSITORY)
      private readonly outboxRepository: IOutboxRepository,
   ) {}

   async createOutboxEvent(
      aggregateId: string,
      aggregateType: string,
      eventType: string,
      payload: Record<string, unknown>,
      tx?: Prisma.TransactionClient,
   ) {
      return this.outboxRepository.create(
         {
            aggregateId,
            aggregateType,
            eventType,
            payload,
         },
         tx,
      );
   }
}
