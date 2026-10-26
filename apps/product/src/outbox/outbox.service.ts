import { Inject, Injectable } from '@nestjs/common';
import { uuidv7 } from '@common';
import { PrismaService } from '@product/prisma';
import type { Prisma, OutboxEvent } from '@product/prisma-client';

export interface EmitOutboxEventOptions {
   aggregateId: string;
   aggregateType: string;
   eventType: string;
   payload: Record<string, unknown>;
   eventId?: string;
   tx?: Prisma.TransactionClient;
}

@Injectable()
export class OutboxService {
   constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

   async emitEvent(options: EmitOutboxEventOptions): Promise<OutboxEvent>;
   async emitEvent(
      aggregateId: string,
      aggregateType: string,
      eventType: string,
      payload: Record<string, unknown>,
      tx?: Prisma.TransactionClient,
   ): Promise<OutboxEvent>;
   async emitEvent(
      paramOrAggregateId: EmitOutboxEventOptions | string,
      aggregateType?: string,
      eventType?: string,
      payload?: Record<string, unknown>,
      tx?: Prisma.TransactionClient,
   ): Promise<OutboxEvent> {
      let aggregateId: string;
      let aggType: string;
      let evtType: string;
      let dataPayload: Record<string, unknown>;
      let clientTx: Prisma.TransactionClient | undefined;
      let eventId: string | undefined;

      if (typeof paramOrAggregateId === 'object') {
         aggregateId = paramOrAggregateId.aggregateId;
         aggType = paramOrAggregateId.aggregateType;
         evtType = paramOrAggregateId.eventType;
         dataPayload = paramOrAggregateId.payload;
         clientTx = paramOrAggregateId.tx;
         eventId = paramOrAggregateId.eventId;
      } else {
         aggregateId = paramOrAggregateId;
         aggType = aggregateType ?? '';
         evtType = eventType ?? '';
         dataPayload = payload ?? {};
         clientTx = tx;
      }

      const client = clientTx || this.prisma;
      return client.outboxEvent.create({
         data: {
            eventId: eventId || uuidv7(),
            aggregateType: aggType,
            aggregateId,
            eventType: evtType,
            payload: dataPayload as Prisma.InputJsonValue,
         },
      });
   }
}
