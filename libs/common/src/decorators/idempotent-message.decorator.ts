import { SetMetadata } from '@nestjs/common';

export const IDEMPOTENT_MESSAGE_METADATA = 'IDEMPOTENT_MESSAGE_METADATA';

export interface IdempotentMessageOptions {
   /**
    * Optional custom key extractor.
    * Can be a static string or a function extracting a string from the message payload.
    * If omitted, defaults to extracting `eventId`, `id`, `messageId`, or `correlationId`.
    */
   key?: string | ((data: unknown) => string);

   /**
    * Time-to-live for the idempotency record in Redis (in seconds).
    * Defaults to 86400 (24 hours).
    */
   ttlSeconds?: number;

   /**
    * Redis key prefix. Defaults to 'idempotency'.
    */
   prefix?: string;

   /**
    * When executed within a RabbitMQ consumer context, automatically ACK duplicate messages
    * to avoid continuous unacknowledged redelivery loops. Defaults to true.
    */
   autoAckOnDuplicate?: boolean;
}

/**
 * Decorator to enforce idempotent message handling across RPC, RabbitMQ, or Controller handlers.
 */
export const IdempotentMessage = (options?: IdempotentMessageOptions): MethodDecorator =>
   SetMetadata(IDEMPOTENT_MESSAGE_METADATA, options || {});
