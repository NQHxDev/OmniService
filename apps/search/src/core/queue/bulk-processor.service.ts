import { Injectable, Logger, OnModuleDestroy, Optional } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter } from 'prom-client';
import { BULK_OPERATIONS } from '@contracts/search';
import { ElasticsearchService } from '@search/core/elasticsearch';
import { METRIC_STATUS } from '@search/core/metrics';
import { BulkOperation } from '@search/core/queue/bulk-operation.interface';
import { SEARCH_INDEXING_QUEUE } from '@search/core/queue/queue.constants';

interface PendingQueueItem {
   op: BulkOperation;
   resolve: () => void;
   reject: (err: unknown) => void;
}

@Processor(SEARCH_INDEXING_QUEUE, {
   concurrency: 10,
   limiter: {
      max: 100,
      duration: 1000,
   },
})
@Injectable()
export class BulkIndexProcessor extends WorkerHost implements OnModuleDestroy {
   private readonly logger = new Logger(BulkIndexProcessor.name);
   private pendingItems: PendingQueueItem[] = [];
   private flushTimer: NodeJS.Timeout | null = null;
   private readonly BATCH_SIZE = 100;
   private readonly FLUSH_INTERVAL = 5000;

   constructor(
      private readonly esService: ElasticsearchService,
      @Optional()
      @InjectMetric('search_indexing_total')
      private readonly indexingCounter?: Counter<string>,
   ) {
      super();
   }

   async process(job: Job<BulkOperation>): Promise<void> {
      return new Promise<void>((resolve, reject) => {
         this.pendingItems.push({
            op: job.data,
            resolve,
            reject,
         });

         if (this.pendingItems.length >= this.BATCH_SIZE) {
            void this.flush();
         } else {
            this.scheduleFlush();
         }
      });
   }

   private scheduleFlush(): void {
      if (this.flushTimer) {
         return;
      }

      this.flushTimer = setTimeout(() => {
         void this.flush();
      }, this.FLUSH_INTERVAL);
   }

   async flush(): Promise<void> {
      if (this.flushTimer) {
         clearTimeout(this.flushTimer);
         this.flushTimer = null;
      }

      if (this.pendingItems.length === 0) {
         return;
      }

      const itemsToFlush = this.pendingItems.splice(0, this.BATCH_SIZE);
      if (itemsToFlush.length === 0) {
         return;
      }

      try {
         const operations: Array<Record<string, unknown>> = [];

         for (const item of itemsToFlush) {
            const { op } = item;
            if (op.operation === BULK_OPERATIONS.INDEX) {
               operations.push({
                  index: { _index: op.index, _id: op.documentId },
               });
               operations.push(op.data ?? {});
            } else if (op.operation === BULK_OPERATIONS.UPDATE) {
               operations.push({
                  update: { _index: op.index, _id: op.documentId },
               });
               operations.push(op.data ?? {});
            } else if (op.operation === BULK_OPERATIONS.DELETE) {
               operations.push({
                  delete: { _index: op.index, _id: op.documentId },
               });
            }
         }

         const client = this.esService.getClient();
         const result = await client.bulk<{
            errors: boolean;
            items: Array<{
               index?: { error?: Record<string, unknown>; status?: number };
               update?: { error?: Record<string, unknown>; status?: number };
               delete?: { error?: Record<string, unknown>; status?: number };
            }>;
         }>({
            operations,
         });

         if (result.errors) {
            const errorList: unknown[] = [];
            result.items.forEach((itemRes, index) => {
               const itemError = itemRes.index?.error || itemRes.update?.error || itemRes.delete?.error;
               const currentOp = itemsToFlush[index]?.op;
               if (itemError) {
                  errorList.push(itemError);
                  if (currentOp) {
                     this.indexingCounter?.inc({
                        index: currentOp.index,
                        operation: currentOp.operation,
                        status: METRIC_STATUS.ERROR,
                     });
                  }
                  itemsToFlush[index]?.reject(new Error(`Bulk error: ${JSON.stringify(itemError)}`));
               } else {
                  if (currentOp) {
                     this.indexingCounter?.inc({
                        index: currentOp.index,
                        operation: currentOp.operation,
                        status: METRIC_STATUS.SUCCESS,
                     });
                  }
                  itemsToFlush[index]?.resolve();
               }
            });
            this.logger.error(`Bulk indexing partial errors: ${JSON.stringify(errorList)}`);
         } else {
            this.logger.log(`Successfully indexed ${itemsToFlush.length} documents via bulk`);
            for (const item of itemsToFlush) {
               this.indexingCounter?.inc({
                  index: item.op.index,
                  operation: item.op.operation,
                  status: METRIC_STATUS.SUCCESS,
               });
               item.resolve();
            }
         }
      } catch (error) {
         this.logger.error(`Bulk flush failed: ${error instanceof Error ? error.message : String(error)}`);
         for (const item of itemsToFlush) {
            this.indexingCounter?.inc({
               index: item.op.index,
               operation: item.op.operation,
               status: METRIC_STATUS.ERROR,
            });
            item.reject(error);
         }
      } finally {
         if (this.pendingItems.length >= this.BATCH_SIZE) {
            void this.flush();
         } else if (this.pendingItems.length > 0) {
            this.scheduleFlush();
         }
      }
   }

   async onModuleDestroy(): Promise<void> {
      if (this.flushTimer) {
         clearTimeout(this.flushTimer);
         this.flushTimer = null;
      }
      if (this.pendingItems.length > 0) {
         await this.flush();
      }
   }
}
