import { Injectable, Logger } from '@nestjs/common';
import { RmqContext, RmqOptions, Transport } from '@nestjs/microservices';
import { Channel, ChannelModel, connect } from 'amqplib';
import { AppConfigService } from '@common/config';
import {
   buildDeadLetterRoutingKey,
   buildDlqQueueName,
   buildDlxExchangeName,
   buildRetryQueueName,
   RMQ_ERROR_ACTIONS,
   RMQ_EXCHANGE_TYPES,
   RMQ_HEADERS,
   RMQ_IDEMPOTENCY_HEADER_KEYS,
   RMQ_QUEUE_ARGUMENTS,
   RMQ_RETRY_CONFIG,
} from '@common/rmq/rmq.constants';
import { RmqErrorClassifier } from '@common/rmq/rmq-error-classifier';
import {
   IRmqErrorHandlerOptions,
   IRmqQueueOptions,
   RmqErrorKind,
   RmqErrorHandlingResult,
   TrackedMessage,
   XDeathHeaderEntry,
} from '@common/rmq/rmq.types';

@Injectable()
export class RmqService {
   private readonly logger = new Logger(RmqService.name);

   constructor(private readonly config: AppConfigService) {}

   getOptions(queue: string, optionsOrNoAck: boolean | IRmqQueueOptions = false): RmqOptions {
      const urls = [this.config.rabbitMq.uri];
      const resolvedQueue = this.config.rabbitMq.getQueue(queue);

      const isNoAck = typeof optionsOrNoAck === 'boolean' ? optionsOrNoAck : (optionsOrNoAck?.noAck ?? false);
      const queueOptions = typeof optionsOrNoAck === 'object' ? optionsOrNoAck : {};

      const withDlx = queueOptions.withDlx ?? true;
      const dlxExchange = queueOptions.dlxExchange ?? buildDlxExchangeName(resolvedQueue);
      const dlxRoutingKey = queueOptions.dlxRoutingKey ?? buildDeadLetterRoutingKey(resolvedQueue);

      const queueArguments: Record<string, unknown> = {
         ...(queueOptions.arguments || {}),
      };

      if (withDlx) {
         queueArguments[RMQ_QUEUE_ARGUMENTS.DEAD_LETTER_EXCHANGE] = dlxExchange;
         queueArguments[RMQ_QUEUE_ARGUMENTS.DEAD_LETTER_ROUTING_KEY] = dlxRoutingKey;
      }

      if (queueOptions.maxPriority !== undefined) {
         queueArguments[RMQ_QUEUE_ARGUMENTS.MAX_PRIORITY] = queueOptions.maxPriority;
      }

      return {
         transport: Transport.RMQ,
         options: {
            urls,
            queue: resolvedQueue,
            noAck: isNoAck,
            prefetchCount:
               queueOptions.prefetchCount !== undefined && queueOptions.prefetchCount !== null
                  ? Number(queueOptions.prefetchCount)
                  : undefined,
            isGlobalPrefetchCount: queueOptions.isGlobalPrefetchCount,
            queueOptions: {
               durable: queueOptions.durable ?? true,
               arguments: Object.keys(queueArguments).length > 0 ? queueArguments : undefined,
            },
         },
      };
   }

   async setupQueueTopology(queue: string, options?: IRmqQueueOptions): Promise<void> {
      const resolvedQueue = this.config.rabbitMq.getQueue(queue);
      const dlxExchange = options?.dlxExchange ?? buildDlxExchangeName(resolvedQueue);
      const dlqQueue = options?.dlqQueue ?? buildDlqQueueName(resolvedQueue);
      const dlxRoutingKey = options?.dlxRoutingKey ?? buildDeadLetterRoutingKey(resolvedQueue);

      let connection: ChannelModel | null = null;
      let channel: Channel | null = null;

      try {
         connection = await connect(this.config.rabbitMq.uri);
         channel = await connection.createChannel();

         // 1. Declare Dead Letter Exchange (DLX) & Dead Letter Queue (DLQ)
         await channel.assertExchange(dlxExchange, RMQ_EXCHANGE_TYPES.DIRECT, { durable: true });
         await channel.assertQueue(dlqQueue, { durable: true });
         await channel.bindQueue(dlqQueue, dlxExchange, dlxRoutingKey);

         // 2. Declare Delayed Retry Queues with TTL dead-lettering back to primary queue
         for (const delayMs of RMQ_RETRY_CONFIG.DEFAULT_BACKOFF_DELAYS_MS) {
            const retryQueue = buildRetryQueueName(resolvedQueue, delayMs);
            await channel.assertQueue(retryQueue, {
               durable: true,
               arguments: {
                  [RMQ_QUEUE_ARGUMENTS.MESSAGE_TTL]: delayMs,
                  [RMQ_QUEUE_ARGUMENTS.DEAD_LETTER_EXCHANGE]: RMQ_RETRY_CONFIG.DEFAULT_DIRECT_EXCHANGE,
                  [RMQ_QUEUE_ARGUMENTS.DEAD_LETTER_ROUTING_KEY]: resolvedQueue,
               },
            });
         }

         // 3. Declare Primary Queue configured with DLX
         await channel.assertQueue(resolvedQueue, {
            durable: true,
            arguments: {
               [RMQ_QUEUE_ARGUMENTS.DEAD_LETTER_EXCHANGE]: dlxExchange,
               [RMQ_QUEUE_ARGUMENTS.DEAD_LETTER_ROUTING_KEY]: dlxRoutingKey,
            },
         });

         this.logger.log(
            `RabbitMQ topology initialized for queue: ${resolvedQueue} (DLX: ${dlxExchange}, DLQ: ${dlqQueue})`,
         );
      } catch (err: unknown) {
         const errMsg = err instanceof Error ? err.message : String(err);
         this.logger.warn(`Could not initialize RabbitMQ topology for ${resolvedQueue}: ${errMsg}`);
      } finally {
         try {
            if (channel) await channel.close();
            if (connection) await connection.close();
         } catch {
            // Silently ignore close errors
         }
      }
   }

   getRetryCount(context?: RmqContext): number {
      if (!context) return 0;
      const originalMessage = context.getMessage() as TrackedMessage | undefined;
      const headers = originalMessage?.properties?.headers;
      if (!headers) return 0;

      const retryHeader = headers[RMQ_HEADERS.RETRY_COUNT];
      if (typeof retryHeader === 'number') {
         return retryHeader;
      }
      if (typeof retryHeader === 'string') {
         const parsed = parseInt(retryHeader, 10);
         if (!isNaN(parsed)) return parsed;
      }

      // Check x-death array count if message was dead-lettered
      const death = headers[RMQ_HEADERS.DEATH] as XDeathHeaderEntry[] | undefined;
      if (Array.isArray(death) && death.length > 0 && typeof death[0]?.count === 'number') {
         return death[0].count;
      }

      return 0;
   }

   getEventId(context?: RmqContext): string | undefined {
      if (!context) return undefined;
      const originalMessage = context.getMessage() as TrackedMessage | undefined;
      const headers = originalMessage?.properties?.headers;
      if (!headers) return undefined;

      for (const key of RMQ_IDEMPOTENCY_HEADER_KEYS) {
         const eventId = headers[key];
         if (typeof eventId === 'string' && eventId) {
            return eventId;
         }
      }

      return undefined;
   }

   ack(context?: RmqContext) {
      if (!context) {
         return;
      }
      try {
         const channel = context.getChannelRef() as Channel | undefined;
         const originalMessage = context.getMessage() as TrackedMessage | undefined;
         if (!channel || !originalMessage || originalMessage.__acked) {
            return;
         }
         originalMessage.__acked = true;
         channel.ack(originalMessage);
      } catch {
         // Silently ignore if channel is already closed or message already acknowledged
      }
   }

   nack(context?: RmqContext, requeue = false) {
      if (!context) {
         return;
      }
      try {
         const channel = context.getChannelRef() as Channel | undefined;
         const originalMessage = context.getMessage() as TrackedMessage | undefined;
         if (!channel || !originalMessage || originalMessage.__acked) {
            return;
         }
         originalMessage.__acked = true;
         channel.nack(originalMessage, false, requeue);
      } catch {
         // Silently ignore if channel is already closed or message already acknowledged
      }
   }

   async handleError(
      error: unknown,
      context?: RmqContext,
      options?: IRmqErrorHandlerOptions,
   ): Promise<RmqErrorHandlingResult> {
      if (!context) {
         return { action: RMQ_ERROR_ACTIONS.SKIPPED, retries: 0 };
      }

      const channel = context.getChannelRef() as Channel | undefined;
      const originalMessage = context.getMessage() as TrackedMessage | undefined;
      if (!channel || !originalMessage || originalMessage.__acked) {
         return { action: RMQ_ERROR_ACTIONS.SKIPPED, retries: 0 };
      }

      const errorKind = RmqErrorClassifier.classify(error, options?.customClassifier);
      const errMsg = error instanceof Error ? error.message : String(error);

      // 1. Poison Message (Non-retryable / Permanent Failure)
      if (errorKind === RmqErrorKind.POISON) {
         this.logger.warn(`[RMQ Poison Error] Unrecoverable error detected, routing to DLQ (no retry): ${errMsg}`);
         this.nack(context, false);
         return { action: RMQ_ERROR_ACTIONS.DLQ_POISON, retries: 0 };
      }

      // 2. Transient Error (Retryable / Temporary Failure)
      const currentRetries = this.getRetryCount(context);
      const maxRetries = options?.maxRetries ?? RMQ_RETRY_CONFIG.DEFAULT_MAX_RETRIES;

      if (currentRetries >= maxRetries) {
         this.logger.error(
            `[RMQ Max Retries Exceeded] Message exceeded ${maxRetries} retries, routing to DLQ: ${errMsg}`,
         );
         this.nack(context, false);
         return { action: RMQ_ERROR_ACTIONS.DLQ_EXHAUSTED, retries: currentRetries };
      }

      const nextRetry = currentRetries + 1;
      const delays = options?.backoffDelaysMs ?? RMQ_RETRY_CONFIG.DEFAULT_BACKOFF_DELAYS_MS;
      const delayMs = delays[Math.min(currentRetries, delays.length - 1)];

      this.logger.warn(
         `[RMQ Transient Error] Transient failure (attempt ${nextRetry}/${maxRetries}), scheduling retry in ${delayMs}ms: ${errMsg}`,
      );

      const targetQueue = options?.queue ? this.config.rabbitMq.getQueue(options.queue) : undefined;

      if (targetQueue) {
         const retryQueueName = buildRetryQueueName(targetQueue, delayMs);
         try {
            await channel.assertQueue(retryQueueName, {
               durable: true,
               arguments: {
                  [RMQ_QUEUE_ARGUMENTS.MESSAGE_TTL]: delayMs,
                  [RMQ_QUEUE_ARGUMENTS.DEAD_LETTER_EXCHANGE]: RMQ_RETRY_CONFIG.DEFAULT_DIRECT_EXCHANGE,
                  [RMQ_QUEUE_ARGUMENTS.DEAD_LETTER_ROUTING_KEY]: targetQueue,
               },
            });

            const headers = {
               ...(originalMessage.properties?.headers || {}),
               [RMQ_HEADERS.RETRY_COUNT]: nextRetry,
               [RMQ_HEADERS.LAST_ERROR]: errMsg.slice(0, 500),
            };

            channel.sendToQueue(retryQueueName, originalMessage.content, {
               headers,
               persistent: true,
            });

            // Once safely routed to retry queue, ack original message from primary queue
            this.ack(context);
            return { action: RMQ_ERROR_ACTIONS.RETRY, retries: nextRetry, delayMs };
         } catch (requeueErr) {
            this.logger.warn(`Failed to route to retry queue, routing to DLQ: ${String(requeueErr)}`);
            this.nack(context, false);
            return { action: RMQ_ERROR_ACTIONS.DLQ_EXHAUSTED, retries: nextRetry };
         }
      }

      // Fallback if no target queue specified: route to DLQ
      this.nack(context, false);
      return { action: RMQ_ERROR_ACTIONS.DLQ_EXHAUSTED, retries: nextRetry };
   }
}
