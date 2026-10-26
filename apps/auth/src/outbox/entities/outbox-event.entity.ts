export interface OutboxEventEntity {
   eventId: string;
   aggregateType: string;
   aggregateId: string;
   eventType: string;
   payload: Record<string, unknown>;
   createdAt: string;
}

export interface CreateOutboxEventData {
   aggregateType: string;
   aggregateId?: string;
   eventType: string;
   payload: Record<string, unknown>;
   eventId?: string;
}
