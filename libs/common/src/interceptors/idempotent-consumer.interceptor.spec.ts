import { ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of, throwError } from 'rxjs';
import { IdempotentConsumerInterceptor } from '@common/interceptors/idempotent-consumer.interceptor';
import { RedisService } from '@common/redis/redis.service';
import { type IdempotentMessageOptions } from '@common/decorators/idempotent-message.decorator';

describe('IdempotentConsumerInterceptor', () => {
   let interceptor: IdempotentConsumerInterceptor;
   let reflector: jest.Mocked<Reflector>;
   let redisService: jest.Mocked<RedisService>;

   beforeEach(() => {
      reflector = {
         get: jest.fn(),
      } as unknown as jest.Mocked<Reflector>;

      redisService = {
         setNx: jest.fn(),
         set: jest.fn(),
         del: jest.fn(),
      } as unknown as jest.Mocked<RedisService>;

      interceptor = new IdempotentConsumerInterceptor(reflector, redisService);
   });

   const createMockExecutionContext = (
      type: 'rpc' | 'http',
      data: unknown,
      rmqChannel?: { ack: jest.Mock },
   ): ExecutionContext => {
      const handler = () => {};
      return {
         getType: () => type,
         getHandler: () => handler,
         switchToRpc: () => ({
            getData: () => data,
            getContext: () => ({
               getChannelRef: () => rmqChannel,
               getMessage: () => ({ fields: { deliveryTag: 1 } }),
            }),
         }),
         switchToHttp: () => ({
            getRequest: () => ({ body: data }),
         }),
      } as unknown as ExecutionContext;
   };

   it('should bypass idempotency check if method has no IdempotentMessage decorator', async () => {
      reflector.get.mockReturnValue(undefined);
      const context = createMockExecutionContext('rpc', { eventId: 'evt-1' });
      const next: CallHandler = { handle: () => of('result') };

      const result$ = await interceptor.intercept(context, next);
      let output: unknown;
      result$.subscribe((val) => {
         output = val;
      });

      expect(output).toBe('result');
      expect(redisService.setNx).not.toHaveBeenCalled();
   });

   it('should process new message, acquire lock, and mark as COMPLETED on success', async () => {
      const options: IdempotentMessageOptions = { ttlSeconds: 120 };
      reflector.get.mockReturnValue(options);
      redisService.setNx.mockResolvedValue(true);
      redisService.set.mockResolvedValue();

      const context = createMockExecutionContext('rpc', { eventId: 'evt-123' });
      const next: CallHandler = { handle: () => of({ processed: true }) };

      const result$ = await interceptor.intercept(context, next);
      let output: unknown;
      result$.subscribe((val) => {
         output = val;
      });

      expect(redisService.setNx).toHaveBeenCalledWith('idempotency:evt-123', 'PROCESSING', 120);
      expect(output).toEqual({ processed: true });
      expect(redisService.set).toHaveBeenCalledWith('idempotency:evt-123', 'COMPLETED', 120);
   });

   it('should release lock if handler fails to allow retry', async () => {
      const options: IdempotentMessageOptions = { ttlSeconds: 60 };
      reflector.get.mockReturnValue(options);
      redisService.setNx.mockResolvedValue(true);
      redisService.del.mockResolvedValue();

      const context = createMockExecutionContext('rpc', { eventId: 'evt-error' });
      const next: CallHandler = {
         handle: () => throwError(() => new Error('Business error')),
      };

      const result$ = await interceptor.intercept(context, next);

      await expect(
         new Promise((resolve, reject) => {
            result$.subscribe({
               next: resolve,
               error: reject,
            });
         }),
      ).rejects.toThrow('Business error');

      expect(redisService.del).toHaveBeenCalledWith('idempotency:evt-error');
   });

   it('should suppress execution and auto-ack message if duplicate detected in RabbitMQ context', async () => {
      const options: IdempotentMessageOptions = { autoAckOnDuplicate: true };
      reflector.get.mockReturnValue(options);
      redisService.setNx.mockResolvedValue(false);

      const ackMock = jest.fn();
      const context = createMockExecutionContext('rpc', { eventId: 'evt-dup' }, { ack: ackMock });
      const next: CallHandler = { handle: jest.fn() };

      const result$ = await interceptor.intercept(context, next);
      let output: unknown;
      result$.subscribe((val) => {
         output = val;
      });

      expect(redisService.setNx).toHaveBeenCalledWith('idempotency:evt-dup', 'PROCESSING', 86400);
      expect(next.handle).not.toHaveBeenCalled();
      expect(ackMock).toHaveBeenCalled();
      expect(output).toEqual({ duplicate: true, eventId: 'evt-dup' });
   });

   it('should support custom key function', async () => {
      const options: IdempotentMessageOptions = {
         key: (data: unknown) => (data as { customId: string }).customId,
         prefix: 'custom_inbox',
      };
      reflector.get.mockReturnValue(options);
      redisService.setNx.mockResolvedValue(true);

      const context = createMockExecutionContext('rpc', { customId: 'custom-999' });
      const next: CallHandler = { handle: () => of('done') };

      await interceptor.intercept(context, next);

      expect(redisService.setNx).toHaveBeenCalledWith('custom_inbox:custom-999', 'PROCESSING', 86400);
   });
});
