import { uuidv7 } from '@common/utils';

/**
 * Standard CloudEvents-compliant Event Envelope for Outbox events and CDC messages.
 */
export interface IOutboxEventEnvelope<T = Record<string, unknown>> {
   eventId: string;
   aggregateType: string;
   aggregateId: string;
   eventType: string;
   payload: T;
   timestamp: string;
   metadata?: Record<string, unknown>;
}

export interface CreateOutboxEventParams<T = Record<string, unknown>> {
   aggregateType: string;
   aggregateId: string;
   eventType: string;
   payload: T;
   eventId?: string;
   timestamp?: string;
   metadata?: Record<string, unknown>;
}

/**
 * Helper to construct a typed, standardized Event Envelope with UUIDv7 and ISO-8601 UTC timestamp.
 */
export function createOutboxEventEnvelope<T = Record<string, unknown>>(
   params: CreateOutboxEventParams<T>,
): IOutboxEventEnvelope<T> {
   return {
      eventId: params.eventId ?? uuidv7(),
      aggregateType: params.aggregateType,
      aggregateId: params.aggregateId,
      eventType: params.eventType,
      payload: params.payload,
      timestamp: params.timestamp ?? new Date().toISOString(),
      metadata: params.metadata,
   };
}
