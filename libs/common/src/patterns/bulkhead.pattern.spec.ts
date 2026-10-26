import { of } from 'rxjs';
import {
   Bulkhead,
   BULKHEAD_REJECTION_REASONS,
   BulkheadRejectedException,
   BulkheadRegistry,
   withBulkhead,
} from '@common/patterns/bulkhead.pattern';
import { UseBulkhead } from '@common/decorators/bulkhead.decorator';

describe('Bulkhead Pattern', () => {
   beforeEach(() => {
      BulkheadRegistry.clear();
      jest.clearAllMocks();
   });

   describe('Basic Concurrency & Execution', () => {
      it('should execute operation immediately when below maxConcurrent', async () => {
         const bulkhead = new Bulkhead({ name: 'test-bulkhead', maxConcurrent: 2 });
         const mockFn = jest.fn().mockResolvedValue('success');

         const result = await bulkhead.execute(mockFn);

         expect(result).toBe('success');
         expect(mockFn).toHaveBeenCalledTimes(1);
         const stats = bulkhead.getStats();
         expect(stats.activeCount).toBe(0);
         expect(stats.totalAccepted).toBe(1);
         expect(stats.totalCompleted).toBe(1);
         expect(stats.totalRejected).toBe(0);
      });

      it('should queue requests when maxConcurrent is reached and process FIFO', async () => {
         const bulkhead = new Bulkhead({
            name: 'test-bulkhead',
            maxConcurrent: 1,
            maxQueueCapacity: 5,
         });

         let resolveCall1!: (val: string) => void;
         const call1Promise = new Promise<string>((res) => {
            resolveCall1 = res;
         });

         const exec1 = bulkhead.execute(() => call1Promise);
         expect(bulkhead.getStats().activeCount).toBe(1);
         expect(bulkhead.getStats().queueCount).toBe(0);

         // Call 2 arrives while Call 1 is in-flight -> goes to queue
         const call2Fn = jest.fn().mockResolvedValue('call2-done');
         const exec2 = bulkhead.execute(call2Fn);

         expect(bulkhead.getStats().activeCount).toBe(1);
         expect(bulkhead.getStats().queueCount).toBe(1);
         expect(call2Fn).not.toHaveBeenCalled();

         // Finish Call 1 -> Call 2 should be dequeued and executed
         resolveCall1('call1-done');
         const res1 = await exec1;
         const res2 = await exec2;

         expect(res1).toBe('call1-done');
         expect(res2).toBe('call2-done');
         expect(call2Fn).toHaveBeenCalledTimes(1);
         expect(bulkhead.getStats().activeCount).toBe(0);
         expect(bulkhead.getStats().queueCount).toBe(0);
         expect(bulkhead.getStats().totalCompleted).toBe(2);
      });
   });

   describe('Queue Saturation (QUEUE_FULL)', () => {
      it('should immediately reject with BulkheadRejectedException when queue is full', async () => {
         const onRejected = jest.fn();
         const bulkhead = new Bulkhead({
            name: 'full-bulkhead',
            maxConcurrent: 1,
            maxQueueCapacity: 1,
            onRejected,
         });

         const hangingPromise = new Promise<never>(() => {});
         // Slot 1 (active)
         void bulkhead.execute(() => hangingPromise).catch(() => {});
         // Slot 2 (queued)
         void bulkhead.execute(() => hangingPromise).catch(() => {});

         expect(bulkhead.getStats().activeCount).toBe(1);
         expect(bulkhead.getStats().queueCount).toBe(1);

         // Slot 3 (exceeds capacity) -> rejected
         await expect(bulkhead.execute(() => Promise.resolve('rejected'))).rejects.toThrow(BulkheadRejectedException);
         expect(onRejected).toHaveBeenCalledWith('full-bulkhead', BULKHEAD_REJECTION_REASONS.QUEUE_FULL);
         expect(bulkhead.getStats().totalRejected).toBe(1);

         bulkhead.reset();
      });

      it('should invoke fallback when queue is full if fallback is provided', async () => {
         const bulkhead = new Bulkhead({
            name: 'fallback-bulkhead',
            maxConcurrent: 1,
            maxQueueCapacity: 0,
         });

         const hangingPromise = new Promise<never>(() => {});
         void bulkhead.execute(() => hangingPromise).catch(() => {});

         const fallbackFn = jest.fn().mockResolvedValue('degraded-fallback');
         const result = await bulkhead.execute(() => Promise.resolve('ok'), fallbackFn);

         expect(result).toBe('degraded-fallback');
         expect(fallbackFn).toHaveBeenCalled();
         expect(bulkhead.getStats().totalRejected).toBe(1);

         bulkhead.reset();
      });
   });

   describe('Queue Timeout (QUEUE_TIMEOUT)', () => {
      it('should reject queued items when queueTimeoutMs expires', async () => {
         const onRejected = jest.fn();
         const bulkhead = new Bulkhead({
            name: 'timeout-bulkhead',
            maxConcurrent: 1,
            maxQueueCapacity: 2,
            queueTimeoutMs: 50,
            onRejected,
         });

         const hangingPromise = new Promise<never>(() => {});
         void bulkhead.execute(() => hangingPromise).catch(() => {});

         // Queued item
         const queuedCall = bulkhead.execute(() => Promise.resolve('done'));

         await expect(queuedCall).rejects.toThrow(BulkheadRejectedException);
         expect(onRejected).toHaveBeenCalledWith('timeout-bulkhead', BULKHEAD_REJECTION_REASONS.QUEUE_TIMEOUT);
         const stats = bulkhead.getStats();
         expect(stats.totalQueueTimeouts).toBe(1);
         expect(stats.queueCount).toBe(0);

         bulkhead.reset();
      });
   });

   describe('RxJS Integration', () => {
      it('withBulkhead operator should control stream concurrency', async () => {
         const bulkhead = new Bulkhead({ name: 'rxjs-bulkhead', maxConcurrent: 2 });
         const source$ = of('stream-item').pipe(withBulkhead(bulkhead));

         const results: string[] = [];
         await new Promise<void>((resolve) => {
            source$.subscribe({
               next: (val) => results.push(val),
               complete: () => resolve(),
            });
         });

         expect(results).toEqual(['stream-item']);
         expect(bulkhead.getStats().totalCompleted).toBe(1);
      });
   });

   describe('BulkheadRegistry', () => {
      it('should retrieve existing or create new instance', () => {
         const b1 = BulkheadRegistry.getOrCreate('service-a', { maxConcurrent: 10 });
         const b2 = BulkheadRegistry.getOrCreate('service-a');
         const b3 = BulkheadRegistry.get('service-a');

         expect(b1).toBe(b2);
         expect(b1).toBe(b3);
         expect(b1.getStats().maxConcurrent).toBe(10);
      });

      it('should clear all instances on clear()', () => {
         BulkheadRegistry.getOrCreate('service-b');
         expect(BulkheadRegistry.getAll().size).toBe(1);

         BulkheadRegistry.clear();
         expect(BulkheadRegistry.getAll().size).toBe(0);
      });
   });

   describe('@UseBulkhead Decorator', () => {
      class TestService {
         @UseBulkhead({
            name: 'decorator-bulkhead',
            maxConcurrent: 1,
            maxQueueCapacity: 0,
         })
         async testMethod(value: string): Promise<string> {
            await new Promise((res) => setTimeout(res, 30));
            return value;
         }
      }

      it('should wrap method and protect concurrency', async () => {
         const service = new TestService();
         const firstCall = service.testMethod('first');

         // Second call during in-flight first call will exceed queue (capacity = 0)
         await expect(service.testMethod('second')).rejects.toThrow(BulkheadRejectedException);

         const firstResult = await firstCall;
         expect(firstResult).toBe('first');
      });
   });
});
