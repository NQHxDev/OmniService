import { Test, TestingModule } from '@nestjs/testing';
import { Job } from 'bullmq';
import { ElasticsearchService } from '@search/core/elasticsearch';
import { METRIC_STATUS } from '@search/core/metrics';
import { BulkIndexProcessor } from '@search/core/queue/bulk-processor.service';
import { BulkOperation } from '@search/core/queue/bulk-operation.interface';

describe('BulkIndexProcessor', () => {
   let processor: BulkIndexProcessor;

   const mockClient = {
      bulk: jest.fn(),
   };

   const mockElasticsearchService = {
      getClient: jest.fn().mockReturnValue(mockClient),
   };

   const mockCounter = {
      inc: jest.fn(),
   };

   beforeEach(async () => {
      jest.clearAllMocks();
      jest.useFakeTimers();

      mockClient.bulk.mockResolvedValue({
         errors: false,
         items: [],
      });

      const module: TestingModule = await Test.createTestingModule({
         providers: [
            BulkIndexProcessor,
            {
               provide: ElasticsearchService,
               useValue: mockElasticsearchService,
            },
            {
               provide: 'PROM_METRIC_SEARCH_INDEXING_TOTAL',
               useValue: mockCounter,
            },
         ],
      }).compile();

      processor = module.get<BulkIndexProcessor>(BulkIndexProcessor);
   });

   afterEach(() => {
      jest.useRealTimers();
   });

   it('should be defined', () => {
      expect(processor).toBeDefined();
   });

   it('should schedule flush when items are added under batch limit', async () => {
      const job = {
         data: {
            operation: 'index' as const,
            index: 'users',
            documentId: 'u-1',
            data: { username: 'test' },
         },
      } as unknown as Job<BulkOperation>;

      const processPromise = processor.process(job);

      expect(mockClient.bulk).not.toHaveBeenCalled();

      // Fast-forward past FLUSH_INTERVAL (5000ms)
      jest.advanceTimersByTime(5000);
      await processPromise;

      expect(mockClient.bulk).toHaveBeenCalledWith({
         operations: [{ index: { _index: 'users', _id: 'u-1' } }, { username: 'test' }],
      });
      expect(mockCounter.inc).toHaveBeenCalledWith({
         index: 'users',
         operation: 'index',
         status: 'success',
      });
   });

   it('should flush immediately when batch limit (100) is reached', async () => {
      const promises: Promise<void>[] = [];

      for (let i = 0; i < 100; i++) {
         const job = {
            data: {
               operation: 'index' as const,
               index: 'users',
               documentId: `u-${i}`,
               data: { index: i },
            },
         } as unknown as Job<BulkOperation>;
         promises.push(processor.process(job));
      }

      await Promise.all(promises);

      expect(mockClient.bulk).toHaveBeenCalledTimes(1);
      const calls = mockClient.bulk.mock.calls as Array<[{ operations: unknown[] }]>;
      const firstCall = calls[0];
      expect(firstCall?.[0].operations).toHaveLength(200); // 100 meta + 100 data
   });

   it('should correctly format update and delete bulk operations', async () => {
      const updateJob = {
         data: {
            operation: 'update' as const,
            index: 'users',
            documentId: 'u-update',
            data: { doc: { name: 'updated' } },
         },
      } as unknown as Job<BulkOperation>;

      const deleteJob = {
         data: {
            operation: 'delete' as const,
            index: 'users',
            documentId: 'u-delete',
         },
      } as unknown as Job<BulkOperation>;

      const p1 = processor.process(updateJob);
      const p2 = processor.process(deleteJob);

      jest.advanceTimersByTime(5000);
      await Promise.all([p1, p2]);

      expect(mockClient.bulk).toHaveBeenCalledWith({
         operations: [
            { update: { _index: 'users', _id: 'u-update' } },
            { doc: { name: 'updated' } },
            { delete: { _index: 'users', _id: 'u-delete' } },
         ],
      });
   });

   it('should reject individual items if bulk returns errors for them', async () => {
      mockClient.bulk.mockResolvedValue({
         errors: true,
         items: [{ index: { status: 200 } }, { index: { error: { reason: 'version conflict' }, status: 409 } }],
      });

      const job1 = {
         data: { operation: 'index' as const, index: 'users', documentId: 'u-1', data: {} },
      } as unknown as Job<BulkOperation>;
      const job2 = {
         data: { operation: 'index' as const, index: 'users', documentId: 'u-2', data: {} },
      } as unknown as Job<BulkOperation>;

      const p1 = processor.process(job1);
      const p2 = processor.process(job2);

      jest.advanceTimersByTime(5000);

      await expect(p1).resolves.toBeUndefined();
      await expect(p2).rejects.toThrow('version conflict');

      expect(mockCounter.inc).toHaveBeenCalledWith({
         index: 'users',
         operation: 'index',
         status: METRIC_STATUS.ERROR,
      });
   });

   it('should reject all items when elasticsearch throws connection error', async () => {
      mockClient.bulk.mockRejectedValue(new Error('Connection refused'));

      const job = {
         data: { operation: 'index' as const, index: 'users', documentId: 'u-err', data: {} },
      } as unknown as Job<BulkOperation>;

      const p = processor.process(job);

      jest.advanceTimersByTime(5000);

      await expect(p).rejects.toThrow('Connection refused');
      expect(mockCounter.inc).toHaveBeenCalledWith({
         index: 'users',
         operation: 'index',
         status: METRIC_STATUS.ERROR,
      });
   });

   it('should flush pending items on module destroy', async () => {
      const job = {
         data: { operation: 'delete' as const, index: 'users', documentId: 'u-destroy' },
      } as unknown as Job<BulkOperation>;

      void processor.process(job);

      await processor.onModuleDestroy();

      expect(mockClient.bulk).toHaveBeenCalledWith({
         operations: [{ delete: { _index: 'users', _id: 'u-destroy' } }],
      });
   });
});
