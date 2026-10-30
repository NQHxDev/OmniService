import { HttpStatus, Logger } from '@nestjs/common';
import { defer, Observable, retry, tap, throwError, timer, type MonoTypeOperatorFunction } from 'rxjs';
import { status as GrpcStatus } from '@grpc/grpc-js';
import { IBuilder } from '@common/patterns/builder.pattern';
import {
   CircuitBreakerOpenException,
   NETWORK_ERROR_CODES,
   NON_RETRYABLE_GRPC_STATUS_CODES,
   SERVICE_FAILURE_KEYWORDS,
} from '@common/patterns/circuit-breaker.pattern';
import { AppException } from '@common/exceptions/app.exception';
import { TimeoutException } from '@common/exceptions/http.exceptions';

/**
 * Common Strategy Pattern interface for calculating retry delays.
 */
export interface IBackoffStrategy {
   /**
    * Computes backoff delay in milliseconds for a specific retry attempt.
    * @param attempt - 1-based attempt count (1 = first retry after initial failure)
    */
   getDelayMs(attempt: number): number;
}

/**
 * Fixed interval backoff strategy.
 */
export class FixedBackoffStrategy implements IBackoffStrategy {
   constructor(private readonly delayMs: number = 200) {}

   getDelayMs(_attempt: number): number {
      return Math.max(0, this.delayMs);
   }
}

export interface LinearBackoffOptions {
   initialDelayMs?: number;
   incrementMs?: number;
   maxDelayMs?: number;
}

/**
 * Linear backoff strategy: delay increases linearly with each attempt.
 */
export class LinearBackoffStrategy implements IBackoffStrategy {
   private readonly initialDelayMs: number;
   private readonly incrementMs: number;
   private readonly maxDelayMs: number;

   constructor(options: LinearBackoffOptions = {}) {
      this.initialDelayMs = options.initialDelayMs ?? 100;
      this.incrementMs = options.incrementMs ?? 100;
      this.maxDelayMs = options.maxDelayMs ?? 3000;
   }

   getDelayMs(attempt: number): number {
      const computed = this.initialDelayMs + Math.max(0, attempt - 1) * this.incrementMs;
      return Math.min(computed, this.maxDelayMs);
   }
}

export const JITTER_TYPES = {
   NONE: 'none',
   FULL: 'full',
   EQUAL: 'equal',
   DECORRELATED: 'decorrelated',
} as const;

export type JitterType = (typeof JITTER_TYPES)[keyof typeof JITTER_TYPES];

export const RETRY_DEFAULTS = {
   MAX_ATTEMPTS: 3,
   INITIAL_DELAY_MS: 100,
   MAX_DELAY_MS: 3000,
   MULTIPLIER: 2,
   JITTER: JITTER_TYPES.FULL,
} as const;

export interface ExponentialBackoffOptions {
   /**
    * Initial delay in milliseconds for the first retry.
    * @default 100
    */
   initialDelayMs?: number;

   /**
    * Maximum ceiling delay in milliseconds.
    * @default 3000
    */
   maxDelayMs?: number;

   /**
    * Multiplier applied exponentially with each subsequent retry.
    * @default 2
    */
   multiplier?: number;

   /**
    * Jitter algorithm to prevent thundering herd problems on downstream services.
    * - JITTER_TYPES.FULL: random between 0 and computed delay
    * - JITTER_TYPES.EQUAL: half computed delay + random half
    * - JITTER_TYPES.DECORRELATED: AWS/Polly decorrelated jitter between initialDelay and 3 * previousSleep
    * - JITTER_TYPES.NONE: exact deterministic exponential delay
    * @default JITTER_TYPES.FULL
    */
   jitter?: JitterType | boolean;
}

/**
 * Exponential backoff strategy with randomized jitter support (GoF Strategy Pattern).
 */
export class ExponentialBackoffStrategy implements IBackoffStrategy {
   private readonly initialDelayMs: number;
   private readonly maxDelayMs: number;
   private readonly multiplier: number;
   private readonly jitter: JitterType;
   private previousSleepMs: number;

   constructor(options: ExponentialBackoffOptions = {}) {
      this.initialDelayMs = options.initialDelayMs ?? RETRY_DEFAULTS.INITIAL_DELAY_MS;
      this.maxDelayMs = options.maxDelayMs ?? RETRY_DEFAULTS.MAX_DELAY_MS;
      this.multiplier = options.multiplier ?? RETRY_DEFAULTS.MULTIPLIER;

      if (typeof options.jitter === 'boolean') {
         this.jitter = options.jitter ? JITTER_TYPES.FULL : JITTER_TYPES.NONE;
      } else {
         this.jitter = options.jitter ?? RETRY_DEFAULTS.JITTER;
      }

      this.previousSleepMs = this.initialDelayMs;
   }

   getDelayMs(attempt: number): number {
      const baseDelay = Math.min(
         this.initialDelayMs * Math.pow(this.multiplier, Math.max(0, attempt - 1)),
         this.maxDelayMs,
      );

      let delay: number;
      switch (this.jitter) {
         case JITTER_TYPES.FULL:
            delay = Math.floor(Math.random() * (baseDelay + 1));
            break;
         case JITTER_TYPES.EQUAL:
            delay = Math.floor(baseDelay / 2 + Math.random() * (baseDelay / 2 + 1));
            break;
         case JITTER_TYPES.DECORRELATED: {
            const low = this.initialDelayMs;
            const high = this.previousSleepMs * 3;
            delay = Math.min(this.maxDelayMs, Math.floor(low + Math.random() * (high - low + 1)));
            this.previousSleepMs = delay;
            break;
         }
         case JITTER_TYPES.NONE:
         default:
            delay = baseDelay;
            break;
      }

      return Math.max(0, delay);
   }
}

/**
 * Transient gRPC status codes that are safe and recommended for automatic retry.
 */
export const RETRYABLE_GRPC_STATUS_CODES: readonly number[] = [
   GrpcStatus.UNAVAILABLE, // 14: Downstream service restarted or network glitch
   GrpcStatus.DEADLINE_EXCEEDED, // 4: Operation timed out
   GrpcStatus.RESOURCE_EXHAUSTED, // 8: Rate limit / capacity pressure
   GrpcStatus.ABORTED, // 10: Concurrency conflict / transaction aborted
] as const;

export { NON_RETRYABLE_GRPC_STATUS_CODES };

export const RETRYABLE_HTTP_STATUS_CODES = [
   HttpStatus.REQUEST_TIMEOUT, // 408
   HttpStatus.TOO_MANY_REQUESTS, // 429
   HttpStatus.BAD_GATEWAY, // 502
   HttpStatus.SERVICE_UNAVAILABLE, // 503
   HttpStatus.GATEWAY_TIMEOUT, // 504
] as const;

export type RetryableHttpStatusCode = (typeof RETRYABLE_HTTP_STATUS_CODES)[number];

export const RESILIENCE_ERROR_NAMES = {
   CIRCUIT_BREAKER_OPEN: 'CircuitBreakerOpenException',
   TIMEOUT_ERROR: 'TimeoutError',
   TIMEOUT_EXCEPTION: 'TimeoutException',
} as const;

export type ResilienceErrorName = (typeof RESILIENCE_ERROR_NAMES)[keyof typeof RESILIENCE_ERROR_NAMES];

export const TIMEOUT_ERROR_NAMES: readonly string[] = [
   RESILIENCE_ERROR_NAMES.TIMEOUT_ERROR,
   RESILIENCE_ERROR_NAMES.TIMEOUT_EXCEPTION,
] as const;

export const TRANSIENT_NETWORK_KEYWORDS = ['ECONNRESET', 'ETIMEDOUT'] as const;
export type TransientNetworkKeyword = (typeof TRANSIENT_NETWORK_KEYWORDS)[number];

/**
 * Predicate to determine whether an error is transient and eligible for gRPC retry.
 */
export const isGrpcRetryable = (error: unknown, allowedGrpcCodes = RETRYABLE_GRPC_STATUS_CODES): boolean => {
   if (!error) return false;

   // 1. Never retry if CircuitBreaker is tripped OPEN - fail fast immediately!
   if (
      error instanceof CircuitBreakerOpenException ||
      (error as Error).name === RESILIENCE_ERROR_NAMES.CIRCUIT_BREAKER_OPEN
   ) {
      return false;
   }

   // 2. Timeout exceptions are transient
   if (
      error instanceof TimeoutException ||
      (typeof (error as Error).name === 'string' && TIMEOUT_ERROR_NAMES.includes((error as Error).name))
   ) {
      return true;
   }

   // 3. Check numeric gRPC status code
   const grpcCode = (error as { code?: number }).code;
   if (typeof grpcCode === 'number') {
      if (allowedGrpcCodes.includes(grpcCode)) {
         return true;
      }
      if (NON_RETRYABLE_GRPC_STATUS_CODES.includes(grpcCode)) {
         return false;
      }
   }

   // 4. Raw Node.js network errors (connection reset, refused, timeout)
   const nodeErrorCode = (error as { code?: string }).code;
   if (typeof nodeErrorCode === 'string' && (NETWORK_ERROR_CODES as readonly string[]).includes(nodeErrorCode)) {
      return true;
   }

   // 5. Check HTTP status code
   const rawStatus = (error as { getStatus?: () => number; statusCode?: number; status?: number }).getStatus
      ? (error as { getStatus: () => number }).getStatus()
      : (error as { statusCode?: number; status?: number }).statusCode || (error as { status?: number }).status;

   if (typeof rawStatus === 'number') {
      if ((RETRYABLE_HTTP_STATUS_CODES as readonly number[]).includes(rawStatus)) {
         return true;
      }
      // Business 4xx errors are not transient
      if (rawStatus >= Number(HttpStatus.BAD_REQUEST) && rawStatus < Number(HttpStatus.INTERNAL_SERVER_ERROR)) {
         return false;
      }
      // 5xx server errors might be transient
      if (rawStatus >= Number(HttpStatus.INTERNAL_SERVER_ERROR)) {
         return true;
      }
   }

   // 6. Common transient error message keywords
   if (error instanceof Error) {
      const msg = error.message;
      if (
         SERVICE_FAILURE_KEYWORDS.some((kw) => msg.includes(kw)) ||
         TRANSIENT_NETWORK_KEYWORDS.some((kw) => msg.includes(kw))
      ) {
         return true;
      }
   }

   // 7. Business AppException (4xx) are non-retryable
   if (error instanceof AppException) {
      return false;
   }

   return false;
};

/**
 * Safely formats unknown errors into human-readable strings for structured logging.
 */
export const formatErrorForLog = (error: unknown): string => {
   if (error instanceof Error) return error.message;
   if (typeof error === 'object' && error !== null) {
      const errObj = error as { message?: unknown; code?: unknown };
      if (typeof errObj.message === 'string') {
         const codeStr =
            typeof errObj.code === 'string' || typeof errObj.code === 'number' ? `[code=${String(errObj.code)}] ` : '';
         return `${codeStr}${errObj.message}`;
      }
      try {
         return JSON.stringify(error);
      } catch {
         return 'Unserializable error object';
      }
   }
   if (typeof error === 'string') return error;
   if (typeof error === 'number' || typeof error === 'boolean') return String(error);
   return 'Unknown error';
};

export interface RetryAttemptContext {
   attempt: number;
   maxAttempts: number;
   delayMs: number;
   error: unknown;
   policyName: string;
}

export interface RetryStats {
   name: string;
   totalCalls: number;
   successfulCalls: number;
   failedCalls: number;
   totalRetries: number;
   exhaustedRetries: number;
   nonRetryableAborts: number;
}

export interface RetryPolicyOptions {
   /**
    * Identifier for this retry policy instance (e.g. 'auth-grpc-check-email').
    */
   name?: string;

   /**
    * Maximum number of execution attempts (including the initial attempt).
    * @default 3
    */
   maxAttempts?: number;

   /**
    * Backoff calculation strategy (GoF Strategy Pattern).
    * If omitted, defaults to ExponentialBackoffStrategy with initialDelayMs=100, maxDelayMs=3000, jitter='full'.
    */
   backoff?: IBackoffStrategy;

   /**
    * Shorthand options for backoff configuration when `backoff` is not explicitly provided.
    */
   initialDelayMs?: number;
   maxDelayMs?: number;
   multiplier?: number;
   jitter?: JitterType | boolean;

   /**
    * Predicate determining if an error is transient and eligible for retry.
    * Defaults to `isGrpcRetryable`.
    */
   isRetryable?: (error: unknown) => boolean;

   /**
    * List of custom retryable gRPC status codes.
    */
   retryableGrpcCodes?: number[];

   /**
    * Timeout in milliseconds for each individual attempt.
    */
   timeoutPerAttemptMs?: number;

   /**
    * Callback triggered on each retry attempt before waiting.
    */
   onRetry?: (context: RetryAttemptContext) => void;
}

/**
 * Enterprise Retry Policy implementation following GoF Strategy & Cloud Resilience Patterns.
 * Provides unified, non-blocking exponential backoff with jitter for Promises and RxJS Observables.
 */
export class RetryPolicy {
   public readonly name: string;
   private readonly maxAttempts: number;
   private readonly backoffStrategy: IBackoffStrategy;
   private readonly isRetryableFn: (error: unknown) => boolean;
   private readonly timeoutPerAttemptMs?: number;
   private readonly onRetryFn?: (context: RetryAttemptContext) => void;
   private readonly logger: Logger;

   private totalCalls = 0;
   private successfulCalls = 0;
   private failedCalls = 0;
   private totalRetries = 0;
   private exhaustedRetries = 0;
   private nonRetryableAborts = 0;

   constructor(options: RetryPolicyOptions = {}) {
      this.name = options.name || 'RetryPolicy';
      this.maxAttempts = Math.max(1, options.maxAttempts ?? 3);

      if (options.backoff) {
         this.backoffStrategy = options.backoff;
      } else {
         this.backoffStrategy = new ExponentialBackoffStrategy({
            initialDelayMs: options.initialDelayMs ?? 100,
            maxDelayMs: options.maxDelayMs ?? 3000,
            multiplier: options.multiplier ?? 2,
            jitter: options.jitter ?? 'full',
         });
      }

      if (options.isRetryable) {
         this.isRetryableFn = options.isRetryable;
      } else if (options.retryableGrpcCodes) {
         const codes = options.retryableGrpcCodes;
         this.isRetryableFn = (err: unknown) => isGrpcRetryable(err, codes);
      } else {
         this.isRetryableFn = isGrpcRetryable;
      }

      this.timeoutPerAttemptMs = options.timeoutPerAttemptMs;
      this.onRetryFn = options.onRetry;
      this.logger = new Logger(`Retry:${this.name}`);
   }

   /**
    * Creates a fluent Builder instance for constructing a `RetryPolicy`.
    */
   static builder(): RetryPolicyBuilder {
      return new RetryPolicyBuilder();
   }

   /**
    * Executes an async operation with automatic retry on transient failure.
    */
   async execute<T>(fn: () => Promise<T>): Promise<T> {
      this.totalCalls++;
      let attempt = 0;

      while (true) {
         attempt++;
         try {
            let result: T;
            if (this.timeoutPerAttemptMs && this.timeoutPerAttemptMs > 0) {
               result = await this.executeWithTimeout(fn, this.timeoutPerAttemptMs);
            } else {
               result = await fn();
            }
            this.successfulCalls++;
            return result;
         } catch (error: unknown) {
            const canRetry = this.isRetryableFn(error);

            if (!canRetry) {
               this.nonRetryableAborts++;
               this.failedCalls++;
               throw error;
            }

            if (attempt >= this.maxAttempts) {
               this.exhaustedRetries++;
               this.failedCalls++;
               this.logger.error(`Retry exhausted after ${attempt} attempts. Final error: ${formatErrorForLog(error)}`);
               throw error;
            }

            const delayMs = this.backoffStrategy.getDelayMs(attempt);
            this.totalRetries++;

            const context: RetryAttemptContext = {
               attempt,
               maxAttempts: this.maxAttempts,
               delayMs,
               error,
               policyName: this.name,
            };

            this.logger.warn(
               `Attempt ${attempt}/${this.maxAttempts} failed (${formatErrorForLog(error)}). Retrying in ${delayMs}ms...`,
            );

            if (this.onRetryFn) {
               try {
                  this.onRetryFn(context);
               } catch (cbErr) {
                  this.logger.error(
                     `Error in onRetry callback: ${cbErr instanceof Error ? cbErr.message : 'Unknown callback error'}`,
                  );
               }
            }

            await this.sleep(delayMs);
         }
      }
   }

   /**
    * Wraps an RxJS Observable with retry logic matching the policy configuration.
    */
   executeObservable<T>(source$: Observable<T>): Observable<T> {
      return defer(() => {
         this.totalCalls++;
         let attempt = 0;

         return source$.pipe(
            retry({
               count: this.maxAttempts - 1,
               delay: (error: unknown) => {
                  attempt++;
                  const canRetry = this.isRetryableFn(error);

                  if (!canRetry) {
                     this.nonRetryableAborts++;
                     this.failedCalls++;
                     return throwError(() => error);
                  }

                  const delayMs = this.backoffStrategy.getDelayMs(attempt);
                  this.totalRetries++;

                  const context: RetryAttemptContext = {
                     attempt,
                     maxAttempts: this.maxAttempts,
                     delayMs,
                     error,
                     policyName: this.name,
                  };

                  this.logger.warn(
                     `Observable attempt ${attempt}/${this.maxAttempts} failed (${formatErrorForLog(error)}). Retrying in ${delayMs}ms...`,
                  );

                  if (this.onRetryFn) {
                     try {
                        this.onRetryFn(context);
                     } catch (cbErr) {
                        this.logger.error(
                           `Error in onRetry callback: ${cbErr instanceof Error ? cbErr.message : 'Unknown callback error'}`,
                        );
                     }
                  }

                  return timer(delayMs);
               },
               resetOnSuccess: true,
            }),
            tap({
               next: () => {
                  this.successfulCalls++;
               },
               error: () => {
                  this.exhaustedRetries++;
                  this.failedCalls++;
               },
            }),
         );
      });
   }

   getStats(): RetryStats {
      return {
         name: this.name,
         totalCalls: this.totalCalls,
         successfulCalls: this.successfulCalls,
         failedCalls: this.failedCalls,
         totalRetries: this.totalRetries,
         exhaustedRetries: this.exhaustedRetries,
         nonRetryableAborts: this.nonRetryableAborts,
      };
   }

   private executeWithTimeout<T>(fn: () => Promise<T>, timeoutMs: number): Promise<T> {
      return new Promise<T>((resolve, reject) => {
         let settled = false;
         const timerId = setTimeout(() => {
            if (!settled) {
               settled = true;
               reject(new TimeoutException(`Retry attempt timed out after ${timeoutMs}ms`));
            }
         }, timeoutMs);

         fn()
            .then((res) => {
               if (!settled) {
                  settled = true;
                  clearTimeout(timerId);
                  resolve(res);
               }
            })
            .catch((err: unknown) => {
               if (!settled) {
                  settled = true;
                  clearTimeout(timerId);
                  reject(err instanceof Error ? err : new Error(String(err)));
               }
            });
      });
   }

   private sleep(ms: number): Promise<void> {
      return new Promise((resolve) => setTimeout(resolve, ms));
   }
}

/**
 * Fluent Builder for constructing a `RetryPolicy` instance (GoF Builder Pattern).
 */
export class RetryPolicyBuilder implements IBuilder<RetryPolicy> {
   private readonly options: RetryPolicyOptions = {};

   name(name: string): this {
      this.options.name = name;
      return this;
   }

   maxAttempts(maxAttempts: number): this {
      this.options.maxAttempts = maxAttempts;
      return this;
   }

   backoff(strategy: IBackoffStrategy): this {
      this.options.backoff = strategy;
      return this;
   }

   fixedBackoff(delayMs: number): this {
      this.options.backoff = new FixedBackoffStrategy(delayMs);
      return this;
   }

   linearBackoff(initialDelayMs = 100, incrementMs = 100, maxDelayMs = 3000): this {
      this.options.backoff = new LinearBackoffStrategy({ initialDelayMs, incrementMs, maxDelayMs });
      return this;
   }

   exponentialBackoff(options?: ExponentialBackoffOptions): this {
      this.options.backoff = new ExponentialBackoffStrategy(options);
      return this;
   }

   retryOn(predicate: (error: unknown) => boolean): this {
      this.options.isRetryable = predicate;
      return this;
   }

   retryOnGrpcCodes(codes: number[]): this {
      this.options.retryableGrpcCodes = codes;
      return this;
   }

   timeoutPerAttempt(timeoutMs: number): this {
      this.options.timeoutPerAttemptMs = timeoutMs;
      return this;
   }

   onRetry(callback: (context: RetryAttemptContext) => void): this {
      this.options.onRetry = callback;
      return this;
   }

   build(): RetryPolicy {
      return new RetryPolicy(this.options);
   }
}

/**
 * Registry Pattern for managing and reusing named `RetryPolicy` instances across services.
 */
export class RetryPolicyRegistry {
   private static readonly instances = new Map<string, RetryPolicy>();

   static getOrCreate(name: string, options?: RetryPolicyOptions): RetryPolicy {
      let policy = this.instances.get(name);
      if (!policy) {
         policy = new RetryPolicy({ ...options, name: options?.name ?? name });
         this.instances.set(name, policy);
      }
      return policy;
   }

   static get(name: string): RetryPolicy | undefined {
      return this.instances.get(name);
   }

   static getAll(): Map<string, RetryPolicy> {
      return new Map(this.instances);
   }

   static clear(): void {
      this.instances.clear();
   }
}

/**
 * RxJS Operator for wrapping microservice/gRPC client Observables with Retry resilience.
 */
export function withGrpcRetry<T>(
   optionsOrPolicy?: RetryPolicy | RetryPolicyOptions | string,
): MonoTypeOperatorFunction<T> {
   let policy: RetryPolicy;
   if (optionsOrPolicy instanceof RetryPolicy) {
      policy = optionsOrPolicy;
   } else if (typeof optionsOrPolicy === 'string') {
      policy = RetryPolicyRegistry.getOrCreate(optionsOrPolicy);
   } else {
      const name = optionsOrPolicy?.name || 'GrpcRetry';
      policy = RetryPolicyRegistry.getOrCreate(name, optionsOrPolicy);
   }

   return (source$: Observable<T>) => {
      return policy.executeObservable(source$);
   };
}

export interface GrpcChannelRetryOptions {
   maxAttempts?: number;
   initialBackoff?: string;
   maxBackoff?: string;
   backoffMultiplier?: number;
   retryableStatusCodes?: string[];
   serviceNames?: string[];
   maxReceiveMessageLength?: number;
   maxSendMessageLength?: number;
}

/**
 * Generates `@grpc/grpc-js` channelOptions service config for low-level gRPC transport retries.
 */
export function createGrpcRetryChannelOptions(options: GrpcChannelRetryOptions = {}): Record<string, unknown> {
   const maxAttempts = options.maxAttempts ?? 3;
   const initialBackoff = options.initialBackoff ?? '0.1s';
   const maxBackoff = options.maxBackoff ?? '1s';
   const backoffMultiplier = options.backoffMultiplier ?? 2;
   const retryableStatusCodes = options.retryableStatusCodes ?? ['UNAVAILABLE', 'DEADLINE_EXCEEDED'];
   const maxReceiveMessageLength = options.maxReceiveMessageLength ?? 50 * 1024 * 1024;
   const maxSendMessageLength = options.maxSendMessageLength ?? 50 * 1024 * 1024;

   const serviceConfig = {
      methodConfig: [
         {
            name:
               options.serviceNames && options.serviceNames.length > 0
                  ? options.serviceNames.map((s) => ({ service: s }))
                  : [{}],
            retryPolicy: {
               maxAttempts,
               initialBackoff,
               maxBackoff,
               backoffMultiplier,
               retryableStatusCodes,
            },
         },
      ],
   };

   return {
      'grpc.service_config': JSON.stringify(serviceConfig),
      'grpc.enable_retries': 1,
      'grpc.max_receive_message_length': maxReceiveMessageLength,
      'grpc.max_send_message_length': maxSendMessageLength,
   };
}
