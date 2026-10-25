import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import {
   IDEMPOTENT_MESSAGE_METADATA,
   type IdempotentMessageOptions,
} from '@common/decorators/idempotent-message.decorator';
import { RedisService } from '@common/redis/redis.service';

interface RabbitMqChannel {
   ack(message: unknown): void;
}

interface RabbitMqContext {
   getChannelRef(): RabbitMqChannel;
   getMessage(): unknown;
}

@Injectable()
export class IdempotentConsumerInterceptor implements NestInterceptor {
   private readonly logger = new Logger(IdempotentConsumerInterceptor.name);

   constructor(
      private readonly reflector: Reflector,
      private readonly redisService: RedisService,
   ) {}

   private extractKey(data: unknown, options: IdempotentMessageOptions): string | null {
      if (typeof options.key === 'function') {
         return options.key(data);
      }
      if (typeof options.key === 'string' && options.key.trim().length > 0) {
         return options.key;
      }
      if (data && typeof data === 'object') {
         const record = data as Record<string, unknown>;
         const candidate = record.eventId || record.id || record.messageId || record.correlationId;
         if (typeof candidate === 'string' && candidate.trim().length > 0) {
            return candidate.trim();
         }
      }
      return null;
   }

   async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
      const options = this.reflector.get<IdempotentMessageOptions>(IDEMPOTENT_MESSAGE_METADATA, context.getHandler());

      // If decorator is not applied, proceed normally
      if (!options) {
         return next.handle();
      }

      let data: unknown;
      if (context.getType() === 'rpc') {
         data = context.switchToRpc().getData();
      } else if (context.getType() === 'http') {
         const request = context.switchToHttp().getRequest<{ body?: unknown }>();
         data = request?.body;
      }

      const rawKey = this.extractKey(data, options);
      if (!rawKey) {
         this.logger.warn('Could not determine idempotency key for incoming message. Skipping idempotency check.');
         return next.handle();
      }

      const prefix = options.prefix || 'idempotency';
      const ttlSeconds = options.ttlSeconds && options.ttlSeconds > 0 ? options.ttlSeconds : 86400;
      const redisKey = `${prefix}:${rawKey}`;

      const acquired = await this.redisService.setNx(redisKey, 'PROCESSING', ttlSeconds);
      if (!acquired) {
         this.logger.log(`Duplicate message detected for key "${redisKey}". Suppressing execution.`);

         // In RabbitMQ contexts, auto-ack the duplicate message so it does not loop in the queue
         if (options.autoAckOnDuplicate !== false && context.getType() === 'rpc') {
            try {
               const rmqCtx = context.switchToRpc().getContext<RabbitMqContext>();
               if (rmqCtx && typeof rmqCtx.getChannelRef === 'function' && typeof rmqCtx.getMessage === 'function') {
                  const channel = rmqCtx.getChannelRef();
                  const message = rmqCtx.getMessage();
                  channel.ack(message);
               }
            } catch (err: unknown) {
               const error = err as Error;
               this.logger.warn(`Failed to acknowledge duplicate RabbitMQ message: ${error.message}`);
            }
         }

         return of({ duplicate: true, eventId: rawKey });
      }

      return next.handle().pipe(
         tap({
            next: async () => {
               try {
                  await this.redisService.set(redisKey, 'COMPLETED', ttlSeconds);
               } catch (err: unknown) {
                  const error = err as Error;
                  this.logger.warn(
                     `Failed to record COMPLETED idempotency state for key "${redisKey}": ${error.message}`,
                  );
               }
            },
            error: async (err: unknown) => {
               const error = err as Error;
               this.logger.warn(
                  `Handler failed for key "${redisKey}". Releasing idempotency lock for retry: ${error.message}`,
               );
               try {
                  await this.redisService.del(redisKey);
               } catch (delErr: unknown) {
                  const deleteError = delErr as Error;
                  this.logger.warn(`Failed to release idempotency key "${redisKey}": ${deleteError.message}`);
               }
            },
         }),
      );
   }
}
