import { Logger } from '@nestjs/common';
import { defer, firstValueFrom, from, isObservable, Observable, type MonoTypeOperatorFunction } from 'rxjs';
import { ServiceUnavailableException } from '@common/exceptions/http.exceptions';
import { COMMON_ERROR_CODES } from '@common/exceptions/error-codes';
import { type IAppExceptionOptions } from '@common/exceptions/exception.types';

export const BULKHEAD_DEFAULTS = {
   MAX_CONCURRENT: 50,
   MAX_QUEUE_CAPACITY: 100,
   QUEUE_TIMEOUT_MS: 1000,
} as const;

export const BULKHEAD_REJECTION_REASONS = {
   EXECUTION_REJECTED: 'EXECUTION_REJECTED',
   QUEUE_FULL: 'QUEUE_FULL',
   QUEUE_TIMEOUT: 'QUEUE_TIMEOUT',
} as const;

export type BulkheadRejectionReason = (typeof BULKHEAD_REJECTION_REASONS)[keyof typeof BULKHEAD_REJECTION_REASONS];

/**
 * Exception thrown when a request cannot be processed by the Bulkhead
 * due to queue saturation, queue timeout, or execution rejection.
 */
export class BulkheadRejectedException extends ServiceUnavailableException {
   constructor(
      public readonly bulkheadName: string,
      public readonly reason: BulkheadRejectionReason,
      options?: Omit<IAppExceptionOptions, 'errorCode' | 'statusCode'>,
   ) {
      super(COMMON_ERROR_CODES.SERVICE_UNAVAILABLE, {
         ...options,
         params: {
            bulkhead: bulkheadName,
            reason,
            ...options?.params,
         },
      });
      this.name = 'BulkheadRejectedException';
   }
}

export interface BulkheadOptions {
   /**
    * Identifier for this bulkhead instance (e.g. 'auth-grpc-bulkhead').
    */
   name?: string;

   /**
    * Maximum number of concurrent executions allowed simultaneously.
    * @default 50
    */
   maxConcurrent?: number;

   /**
    * Maximum number of pending calls queued when concurrency limit is reached.
    * When queue capacity is exceeded, new requests are rejected immediately with BulkheadRejectedException ('QUEUE_FULL').
    * @default 100
    */
   maxQueueCapacity?: number;

   /**
    * Maximum time (in milliseconds) a request can wait in queue before timing out.
    * @default 1000
    */
   queueTimeoutMs?: number;

   /**
    * Optional callback triggered whenever a request is rejected by the bulkhead.
    */
   onRejected?: (name: string, reason: BulkheadRejectionReason) => void;
}

export interface BulkheadStats {
   name: string;
   activeCount: number;
   queueCount: number;
   maxConcurrent: number;
   maxQueueCapacity: number;
   totalAccepted: number;
   totalCompleted: number;
   totalRejected: number;
   totalQueueTimeouts: number;
}

interface EnqueuedTask<T> {
   fn: () => Promise<T>;
   fallback?: (error: Error) => Promise<T> | T;
   resolve: (value: T) => void;
   reject: (reason: unknown) => void;
   timer?: NodeJS.Timeout;
   enqueuedAt: number;
}

/**
 * Bulkhead Pattern implementation.
 * Limits the number of concurrent in-flight requests and enqueues overflow up to a configured threshold.
 * Isolates downstream failures, prevents thread/socket starvation, and protects the Node.js Event Loop.
 */
export class Bulkhead {
   private readonly logger: Logger;
   public readonly name: string;
   private readonly maxConcurrent: number;
   private readonly maxQueueCapacity: number;
   private readonly queueTimeoutMs: number;
   private readonly onRejectedFn?: (name: string, reason: BulkheadRejectionReason) => void;

   private activeCount = 0;
   private queue: Array<EnqueuedTask<unknown>> = [];

   private totalAccepted = 0;
   private totalCompleted = 0;
   private totalRejected = 0;
   private totalQueueTimeouts = 0;

   constructor(options: BulkheadOptions = {}) {
      this.name = options.name || 'Bulkhead';
      this.maxConcurrent = options.maxConcurrent ?? BULKHEAD_DEFAULTS.MAX_CONCURRENT;
      this.maxQueueCapacity = options.maxQueueCapacity ?? BULKHEAD_DEFAULTS.MAX_QUEUE_CAPACITY;
      this.queueTimeoutMs = options.queueTimeoutMs ?? BULKHEAD_DEFAULTS.QUEUE_TIMEOUT_MS;
      this.onRejectedFn = options.onRejected;
      this.logger = new Logger(`Bulkhead:${this.name}`);
   }

   /**
    * Executes an asynchronous operation protected by the Bulkhead concurrency limiter.
    */
   async execute<T>(fn: () => Promise<T>, fallback?: (error: Error) => Promise<T> | T): Promise<T> {
      this.totalAccepted++;

      // 1. If concurrency slot available, execute immediately
      if (this.activeCount < this.maxConcurrent) {
         return this.runWithConcurrencySlot(fn, fallback);
      }

      // 2. If queue is full, reject immediately (fail-fast)
      if (this.queue.length >= this.maxQueueCapacity) {
         this.totalRejected++;
         this.onRejectedFn?.(this.name, BULKHEAD_REJECTION_REASONS.QUEUE_FULL);
         this.logger.warn(`Bulkhead [${this.name}] queue saturated (${this.queue.length}/${this.maxQueueCapacity}).`);
         const error = new BulkheadRejectedException(this.name, BULKHEAD_REJECTION_REASONS.QUEUE_FULL);
         if (fallback) {
            return await fallback(error);
         }
         throw error;
      }

      // 3. Enqueue and wait for an available execution slot
      return new Promise<T>((resolve, reject) => {
         let timer: NodeJS.Timeout | undefined;

         if (this.queueTimeoutMs > 0) {
            timer = setTimeout(() => {
               const index = this.queue.indexOf(task);
               if (index !== -1) {
                  this.queue.splice(index, 1);
                  this.totalRejected++;
                  this.totalQueueTimeouts++;
                  this.onRejectedFn?.(this.name, BULKHEAD_REJECTION_REASONS.QUEUE_TIMEOUT);
                  this.logger.warn(
                     `Bulkhead [${this.name}] request timed out waiting in queue (${this.queueTimeoutMs}ms).`,
                  );
                  const timeoutError = new BulkheadRejectedException(
                     this.name,
                     BULKHEAD_REJECTION_REASONS.QUEUE_TIMEOUT,
                  );
                  if (fallback) {
                     Promise.resolve(fallback(timeoutError)).then(resolve, reject);
                  } else {
                     reject(timeoutError);
                  }
               }
            }, this.queueTimeoutMs);
            timer.unref?.();
         }

         const task: EnqueuedTask<T> = {
            fn,
            fallback,
            resolve,
            reject,
            timer,
            enqueuedAt: Date.now(),
         };

         this.queue.push(task);
      });
   }

   /**
    * Executes an RxJS Observable with Bulkhead concurrency control.
    */
   executeObservable<T>(
      source$: Observable<T>,
      fallback?: (error: Error) => Observable<T> | Promise<T> | T,
   ): Observable<T> {
      return defer(() => {
         return from(
            this.execute(
               () => firstValueFrom(source$),
               fallback
                  ? async (err) => {
                       const fb = fallback(err);
                       if (isObservable(fb)) {
                          return await firstValueFrom(fb);
                       }
                       return await Promise.resolve(fb);
                    }
                  : undefined,
            ),
         );
      });
   }

   private async runWithConcurrencySlot<T>(
      fn: () => Promise<T>,
      fallback?: (error: Error) => Promise<T> | T,
   ): Promise<T> {
      this.activeCount++;
      try {
         const result = await fn();
         this.totalCompleted++;
         return result;
      } catch (error: unknown) {
         if (fallback) {
            return await fallback(error instanceof Error ? error : new Error(String(error)));
         }
         throw error;
      } finally {
         this.activeCount--;
         this.dequeueAndRunNext();
      }
   }

   private dequeueAndRunNext(): void {
      if (this.activeCount >= this.maxConcurrent || this.queue.length === 0) {
         return;
      }

      const task = this.queue.shift();
      if (!task) return;

      if (task.timer) {
         clearTimeout(task.timer);
         task.timer = undefined;
      }

      this.runWithConcurrencySlot(task.fn, task.fallback).then(task.resolve, task.reject);
   }

   getStats(): BulkheadStats {
      return {
         name: this.name,
         activeCount: this.activeCount,
         queueCount: this.queue.length,
         maxConcurrent: this.maxConcurrent,
         maxQueueCapacity: this.maxQueueCapacity,
         totalAccepted: this.totalAccepted,
         totalCompleted: this.totalCompleted,
         totalRejected: this.totalRejected,
         totalQueueTimeouts: this.totalQueueTimeouts,
      };
   }

   reset(): void {
      for (const task of this.queue) {
         if (task.timer) {
            clearTimeout(task.timer);
         }
         const err = new BulkheadRejectedException(this.name, BULKHEAD_REJECTION_REASONS.EXECUTION_REJECTED);
         if (task.fallback) {
            Promise.resolve(task.fallback(err)).then(task.resolve, task.reject);
         } else {
            task.reject(err);
         }
      }
      this.queue = [];
      this.activeCount = 0;
   }
}

/**
 * RxJS Operator for wrapping microservice/gRPC client Observables with Bulkhead concurrency control.
 */
export function withBulkhead<T>(
   bulkhead: Bulkhead,
   fallback?: (error: Error) => Observable<T> | Promise<T> | T,
): MonoTypeOperatorFunction<T> {
   return (source$: Observable<T>) => {
      return bulkhead.executeObservable(source$, fallback);
   };
}

/**
 * Registry / Factory pattern to manage, reuse, and inspect Bulkhead instances across OmniServices.
 */
export class BulkheadRegistry {
   private static readonly instances = new Map<string, Bulkhead>();

   static getOrCreate(name: string, options?: Omit<BulkheadOptions, 'name'>): Bulkhead {
      let bulkhead = this.instances.get(name);
      if (!bulkhead) {
         bulkhead = new Bulkhead({ ...options, name });
         this.instances.set(name, bulkhead);
      }
      return bulkhead;
   }

   static get(name: string): Bulkhead | undefined {
      return this.instances.get(name);
   }

   static getAll(): Map<string, Bulkhead> {
      return new Map(this.instances);
   }

   static clear(): void {
      for (const instance of this.instances.values()) {
         instance.reset();
      }
      this.instances.clear();
   }
}
