import { Test, TestingModule } from '@nestjs/testing';
import { RmqContext } from '@nestjs/microservices';
import { AppConfigService } from '@common/config';
import { RMQ_ERROR_ACTIONS } from '@common/rmq/rmq.constants';
import { RmqErrorClassifier } from '@common/rmq/rmq-error-classifier';
import { RmqService } from '@common/rmq/rmq.service';
import { RmqErrorKind, TrackedMessage } from '@common/rmq/rmq.types';

describe('RmqService & RmqErrorClassifier', () => {
   let service: RmqService;
   let mockConfig: {
      rabbitMq: {
         uri: string;
         getQueue: jest.Mock;
      };
   };

   beforeEach(async () => {
      mockConfig = {
         rabbitMq: {
            uri: 'amqp://guest:guest@localhost:5672',
            getQueue: jest.fn((q: string) => `${q.toLowerCase()}_queue`),
         },
      };

      const module: TestingModule = await Test.createTestingModule({
         providers: [
            RmqService,
            {
               provide: AppConfigService,
               useValue: mockConfig,
            },
         ],
      }).compile();

      service = module.get<RmqService>(RmqService);
   });

   describe('getOptions', () => {
      it('should generate default RMQ options with DLX enabled', () => {
         const options = service.getOptions('NOTIFICATION');

         expect(options.options).toBeDefined();
         expect(options.options?.queue).toBe('notification_queue');
         expect(options.options?.noAck).toBe(false);
         expect(options.options?.queueOptions?.durable).toBe(true);
         expect(options.options?.queueOptions?.arguments).toEqual({
            'x-dead-letter-exchange': 'notification_queue.dlx',
            'x-dead-letter-routing-key': 'notification_queue.dead-letter',
         });
      });

      it('should support legacy boolean noAck argument', () => {
         const options = service.getOptions('NOTIFICATION', true);
         expect(options.options?.noAck).toBe(true);
      });

      it('should allow custom DLX, routing key, and priority', () => {
         const options = service.getOptions('NOTIFICATION', {
            noAck: true,
            dlxExchange: 'custom.dlx',
            dlxRoutingKey: 'custom.key',
            maxPriority: 10,
         });

         expect(options.options?.noAck).toBe(true);
         expect(options.options?.queueOptions?.arguments).toEqual({
            'x-dead-letter-exchange': 'custom.dlx',
            'x-dead-letter-routing-key': 'custom.key',
            'x-max-priority': 10,
         });
      });

      it('should disable DLX arguments if withDlx is explicitly false', () => {
         const options = service.getOptions('NOTIFICATION', {
            withDlx: false,
         });

         expect(options.options?.queueOptions?.arguments).toBeUndefined();
      });
   });

   describe('getClientOptions', () => {
      it('should default noAck to true for client RMQ options', () => {
         const options = service.getClientOptions('NOTIFICATION');

         expect(options.options).toBeDefined();
         expect(options.options?.queue).toBe('notification_queue');
         expect(options.options?.noAck).toBe(true);
      });

      it('should preserve custom options while keeping noAck true if not specified', () => {
         const options = service.getClientOptions('NOTIFICATION', {
            withDlx: false,
            maxPriority: 5,
         });

         expect(options.options?.noAck).toBe(true);
         expect(options.options?.queueOptions?.arguments).toEqual({
            'x-max-priority': 5,
         });
      });
   });

   describe('getRetryCount & getEventId', () => {
      it('should extract retry count from number, string, or x-death header', () => {
         const makeCtx = (headers: Record<string, unknown>) =>
            ({
               getChannelRef: jest.fn(),
               getMessage: () => ({ properties: { headers } }),
            }) as unknown as RmqContext;

         expect(service.getRetryCount(undefined)).toBe(0);
         expect(service.getRetryCount(makeCtx({}))).toBe(0);
         expect(service.getRetryCount(makeCtx({ 'x-retry-count': 2 }))).toBe(2);
         expect(service.getRetryCount(makeCtx({ 'x-retry-count': '3' }))).toBe(3);
         expect(service.getRetryCount(makeCtx({ 'x-death': [{ count: 4 }] }))).toBe(4);
      });

      it('should extract eventId from various header conventions', () => {
         const makeCtx = (headers: Record<string, unknown>) =>
            ({
               getChannelRef: jest.fn(),
               getMessage: () => ({ properties: { headers } }),
            }) as unknown as RmqContext;

         expect(service.getEventId(undefined)).toBeUndefined();
         expect(service.getEventId(makeCtx({}))).toBeUndefined();
         expect(service.getEventId(makeCtx({ 'x-idempotency-key': 'evt-1' }))).toBe('evt-1');
         expect(service.getEventId(makeCtx({ 'idempotency-key': 'evt-2' }))).toBe('evt-2');
         expect(service.getEventId(makeCtx({ eventId: 'evt-3' }))).toBe('evt-3');
      });
   });

   describe('ack & nack', () => {
      it('should call channel.ack on untracked message and mark as acked', () => {
         const mockChannel = { ack: jest.fn() };
         const mockMessage: TrackedMessage = { content: Buffer.from('test') } as TrackedMessage;
         const mockContext = {
            getChannelRef: () => mockChannel,
            getMessage: () => mockMessage,
         } as unknown as RmqContext;

         service.ack(mockContext);
         expect(mockChannel.ack).toHaveBeenCalledWith(mockMessage);
         expect(mockMessage.__acked).toBe(true);

         // Second call should not double ack
         service.ack(mockContext);
         expect(mockChannel.ack).toHaveBeenCalledTimes(1);
      });

      it('should call channel.nack on untracked message and mark as acked', () => {
         const mockChannel = { nack: jest.fn() };
         const mockMessage: TrackedMessage = { content: Buffer.from('test') } as TrackedMessage;
         const mockContext = {
            getChannelRef: () => mockChannel,
            getMessage: () => mockMessage,
         } as unknown as RmqContext;

         service.nack(mockContext, false);
         expect(mockChannel.nack).toHaveBeenCalledWith(mockMessage, false, false);
         expect(mockMessage.__acked).toBe(true);

         // Second call should not double nack
         service.nack(mockContext, false);
         expect(mockChannel.nack).toHaveBeenCalledTimes(1);
      });
   });

   describe('handleError', () => {
      it('should immediately route poison error to DLQ (no retry)', async () => {
         const mockChannel = {
            nack: jest.fn(),
            ack: jest.fn(),
         };
         const mockMessage: TrackedMessage = {
            content: Buffer.from('data'),
            properties: { headers: {} },
         } as unknown as TrackedMessage;
         const mockContext = {
            getChannelRef: () => mockChannel,
            getMessage: () => mockMessage,
         } as unknown as RmqContext;

         const validationError = new Error('ValidationError: invalid email');
         validationError.name = 'ValidationError';

         const result = await service.handleError(validationError, mockContext, { queue: 'NOTIFICATION' });

         expect(result.action).toBe(RMQ_ERROR_ACTIONS.DLQ_POISON);
         expect(mockChannel.nack).toHaveBeenCalledWith(mockMessage, false, false);
         expect(mockChannel.ack).not.toHaveBeenCalled();
      });

      it('should route transient error to retry delay queue when under max retries', async () => {
         const mockChannel = {
            assertQueue: jest.fn().mockResolvedValue({}),
            sendToQueue: jest.fn().mockReturnValue(true),
            ack: jest.fn(),
            nack: jest.fn(),
         };
         const mockMessage: TrackedMessage = {
            content: Buffer.from('data'),
            properties: { headers: { 'x-retry-count': 0 } },
         } as unknown as TrackedMessage;
         const mockContext = {
            getChannelRef: () => mockChannel,
            getMessage: () => mockMessage,
         } as unknown as RmqContext;

         const networkError = new Error('connect ETIMEDOUT');
         (networkError as unknown as Record<string, unknown>).code = 'ETIMEDOUT';

         const result = await service.handleError(networkError, mockContext, {
            queue: 'NOTIFICATION',
            maxRetries: 3,
            backoffDelaysMs: [5000, 30000, 120000],
         });

         expect(result.action).toBe(RMQ_ERROR_ACTIONS.RETRY);
         expect(result.retries).toBe(1);
         expect(result.delayMs).toBe(5000);
         expect(mockChannel.assertQueue).toHaveBeenCalledWith(
            'notification_queue_retry_5000ms',
            expect.objectContaining({
               arguments: {
                  'x-message-ttl': 5000,
                  'x-dead-letter-exchange': '',
                  'x-dead-letter-routing-key': 'notification_queue',
               },
            }),
         );
         expect(mockChannel.sendToQueue).toHaveBeenCalledWith(
            'notification_queue_retry_5000ms',
            mockMessage.content,
            expect.objectContaining({
               headers: expect.objectContaining({ 'x-retry-count': 1 }),
            }),
         );
         expect(mockChannel.ack).toHaveBeenCalledWith(mockMessage);
         expect(mockChannel.nack).not.toHaveBeenCalled();
      });

      it('should route transient error to DLQ when max retries are exhausted', async () => {
         const mockChannel = {
            assertQueue: jest.fn(),
            sendToQueue: jest.fn(),
            ack: jest.fn(),
            nack: jest.fn(),
         };
         const mockMessage: TrackedMessage = {
            content: Buffer.from('data'),
            properties: { headers: { 'x-retry-count': 3 } },
         } as unknown as TrackedMessage;
         const mockContext = {
            getChannelRef: () => mockChannel,
            getMessage: () => mockMessage,
         } as unknown as RmqContext;

         const rateLimitError = new Error('HTTP 429 Too Many Requests');
         (rateLimitError as unknown as Record<string, unknown>).statusCode = 429;

         const result = await service.handleError(rateLimitError, mockContext, {
            queue: 'NOTIFICATION',
            maxRetries: 3,
         });

         expect(result.action).toBe(RMQ_ERROR_ACTIONS.DLQ_EXHAUSTED);
         expect(mockChannel.nack).toHaveBeenCalledWith(mockMessage, false, false);
         expect(mockChannel.ack).not.toHaveBeenCalled();
      });
   });

   describe('RmqErrorClassifier', () => {
      it('should classify 4xx errors as POISON', () => {
         expect(RmqErrorClassifier.classify({ statusCode: 400 })).toBe(RmqErrorKind.POISON);
         expect(RmqErrorClassifier.classify({ statusCode: 404 })).toBe(RmqErrorKind.POISON);
         expect(RmqErrorClassifier.classify({ statusCode: 422 })).toBe(RmqErrorKind.POISON);
         // 408 & 429 are transient
         expect(RmqErrorClassifier.classify({ statusCode: 408 })).toBe(RmqErrorKind.TRANSIENT);
         expect(RmqErrorClassifier.classify({ statusCode: 429 })).toBe(RmqErrorKind.TRANSIENT);
      });

      it('should classify validation and syntax errors as POISON', () => {
         expect(RmqErrorClassifier.classify(new SyntaxError('Unexpected token'))).toBe(RmqErrorKind.POISON);
         expect(RmqErrorClassifier.classify({ name: 'BadRequestException' })).toBe(RmqErrorKind.POISON);
         expect(RmqErrorClassifier.classify({ name: 'ValidationException' })).toBe(RmqErrorKind.POISON);
      });

      it('should classify connection reset and server errors as TRANSIENT', () => {
         expect(RmqErrorClassifier.classify({ code: 'ECONNRESET' })).toBe(RmqErrorKind.TRANSIENT);
         expect(RmqErrorClassifier.classify({ code: 'ETIMEDOUT' })).toBe(RmqErrorKind.TRANSIENT);
         expect(RmqErrorClassifier.classify({ statusCode: 500 })).toBe(RmqErrorKind.TRANSIENT);
         expect(RmqErrorClassifier.classify({ statusCode: 503 })).toBe(RmqErrorKind.TRANSIENT);
      });
   });
});
