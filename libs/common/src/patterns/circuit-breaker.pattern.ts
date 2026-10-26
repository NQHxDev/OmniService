import { Logger } from '@nestjs/common';
import { defer, firstValueFrom, from, isObservable, Observable, type MonoTypeOperatorFunction } from 'rxjs';
import { status as GrpcStatus } from '@grpc/grpc-js';
import { AppException } from '@common/exceptions/app.exception';
import { ServiceUnavailableException, TimeoutException } from '@common/exceptions/http.exceptions';
import { CLIENT_COMMON_ERROR_CODES, COMMON_ERROR_CODES } from '@common/exceptions/error-codes';
import { type IAppExceptionOptions } from '@common/exceptions/exception.types';

/**
 * HTTP status code thresholds for classifying client vs server errors.
 */
export const HTTP_STATUS_THRESHOLDS = {
   CLIENT_ERROR_MIN: 400,
   SERVER_ERROR_MIN: 500,
   REQUEST_TIMEOUT: 408,
} as const;

/**
 * Non-retryable gRPC status codes (business validation, auth failure, permanent errors).
 * These represent normal client-side business outcomes rather than infrastructure outages.
 */
export const NON_RETRYABLE_GRPC_STATUS_CODES: readonly number[] = [
   GrpcStatus.INVALID_ARGUMENT, // 3: Bad Request
   GrpcStatus.NOT_FOUND, // 5: Entity not found
   GrpcStatus.ALREADY_EXISTS, // 6: Conflict
   GrpcStatus.PERMISSION_DENIED, // 7: Forbidden
   GrpcStatus.UNAUTHENTICATED, // 16: Unauthorized
   GrpcStatus.FAILED_PRECONDITION, // 9: Precondition failed
   GrpcStatus.OUT_OF_RANGE, // 11: Out of range
   GrpcStatus.UNIMPLEMENTED, // 12: Not implemented
] as const;

export enum CircuitState {
   CLOSED = 'CLOSED',
   OPEN = 'OPEN',
   HALF_OPEN = 'HALF_OPEN',
}

export class CircuitBreakerOpenException extends ServiceUnavailableException {
   constructor(
      public readonly serviceName: string,
      public readonly resetTimeoutMs: number,
      options?: Omit<IAppExceptionOptions, 'errorCode' | 'statusCode'>,
   ) {
      super(COMMON_ERROR_CODES.SERVICE_UNAVAILABLE, {
         ...options,
         params: {
            service: serviceName,
            state: CircuitState.OPEN,
            resetTimeoutMs,
            ...options?.params,
         },
      });
      this.name = 'CircuitBreakerOpenException';
   }
}

export const SLIDING_WINDOW_TYPES = {
   COUNT_BASED: 'COUNT_BASED',
   TIME_BASED: 'TIME_BASED',
} as const;

export type SlidingWindowType = (typeof SLIDING_WINDOW_TYPES)[keyof typeof SLIDING_WINDOW_TYPES];

export interface CircuitBreakerStats {
   name: string;
   state: CircuitState;
   failureCount: number;
   consecutiveSuccesses: number;
   lastFailureTime?: number;
   lastSuccessTime?: number;
   lastStateChangeTime: number;
   nextAttemptTime?: number;
   totalExecutions: number;
   totalFailures: number;
   totalSuccesses: number;
   totalShortCircuits: number;
   slidingWindowType: SlidingWindowType;
   callsInWindow: number;
   failuresInWindow: number;
   failureRate: number;
}

export interface CircuitBreakerOptions {
   /**
    * Identifier for this circuit breaker instance (e.g. 'auth-grpc-service').
    */
   name?: string;

   /**
    * Type of sliding window used to record call outcomes in CLOSED state.
    * - 'COUNT_BASED': sliding window over the last N calls.
    * - 'TIME_BASED': sliding window over the last N milliseconds.
    * @default 'COUNT_BASED'
    */
   slidingWindowType?: SlidingWindowType;

   /**
    * Size of the count-based sliding window (number of calls recorded).
    * Used when slidingWindowType is 'COUNT_BASED'.
    * @default 100
    */
   slidingWindowSize?: number;

   /**
    * Duration in milliseconds of the time-based sliding window.
    * Used when slidingWindowType is 'TIME_BASED'.
    * @default 10000 (10s)
    */
   slidingWindowDurationMs?: number;

   /**
    * Minimum number of recorded calls required in the sliding window before the failure rate is evaluated.
    * Prevents tripping when call volume is low.
    * @default 10
    */
   minimumNumberOfCalls?: number;

   /**
    * Percentage of failures (0 to 100) in the sliding window to trip the circuit to OPEN.
    * For example, 50 means 50% failure rate.
    * @default 50
    */
   failureRateThreshold?: number;

   /**
    * Number of consecutive failures required in CLOSED state to trip the circuit to OPEN.
    * Acts as an immediate safety floor / fast-fail when calls are below minimumNumberOfCalls.
    * @default 5
    */
   failureThreshold?: number;

   /**
    * Number of consecutive successful probe calls in HALF_OPEN state to recover to CLOSED.
    * @default 2
    */
   successThreshold?: number;

   /**
    * Max execution timeout in milliseconds per call. Prevents threads/sockets from blocking for 30s.
    * @default 3000
    */
   timeout?: number;

   /**
    * Cooldown duration in milliseconds to remain in OPEN before transitioning to HALF_OPEN.
    * @default 10000
    */
   resetTimeout?: number;

   /**
    * Custom predicate to determine whether an error should count as a circuit failure.
    * Business validation errors (4xx like 400 Bad Request, 404, 409 Conflict) should NOT trip the circuit.
    */
   isFailure?: (error: unknown) => boolean;

   /**
    * Callback triggered whenever the circuit state transitions.
    */
   onStateChange?: (from: CircuitState, to: CircuitState, name: string) => void;
}

/**
 * System-level Node.js network error codes that represent infrastructure failures.
 */
export const NETWORK_ERROR_CODES = ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNRESET', 'EPIPE'] as const;

export type NetworkErrorCode = (typeof NETWORK_ERROR_CODES)[number];

/**
 * Text keywords found in unformatted gRPC/network error messages indicating downstream service outage.
 */
export const SERVICE_FAILURE_KEYWORDS = ['UNAVAILABLE', 'DEADLINE_EXCEEDED', 'ECONNREFUSED'] as const;

export type ServiceFailureKeyword = (typeof SERVICE_FAILURE_KEYWORDS)[number];

/**
 * Default configuration values for Circuit Breakers across OmniServices.
 */
export const CIRCUIT_BREAKER_DEFAULTS = {
   FAILURE_THRESHOLD: 5,
   SUCCESS_THRESHOLD: 2,
   TIMEOUT_MS: 3000,
   RESET_TIMEOUT_MS: 10000,
   SLIDING_WINDOW_TYPE: SLIDING_WINDOW_TYPES.COUNT_BASED,
   SLIDING_WINDOW_SIZE: 100,
   SLIDING_WINDOW_DURATION_MS: 10000,
   MINIMUM_NUMBER_OF_CALLS: 10,
   FAILURE_RATE_THRESHOLD: 50,
} as const;

/**
 * Default failure classifier:
 * - 4xx AppException / HttpException (Bad Request, Unauthorized, Conflict, Not Found) are normal business outcomes -> NOT failures.
 * - Timeouts, 5xx server errors, network crashes (ECONNREFUSED), and gRPC UNAVAILABLE/DEADLINE_EXCEEDED -> ARE failures.
 */
export const defaultIsFailure = (error: unknown): boolean => {
   if (!error) return false;

   // Timeout errors
   if (
      error instanceof TimeoutException ||
      (error as Error).name === 'TimeoutError' ||
      (error as Error).name === 'TimeoutException'
   ) {
      return true;
   }

   // gRPC specific status codes: UNAVAILABLE (14), DEADLINE_EXCEEDED (4), INTERNAL (13)
   const grpcCode = (error as { code?: number }).code;
   if (
      grpcCode === GrpcStatus.UNAVAILABLE ||
      grpcCode === GrpcStatus.DEADLINE_EXCEEDED ||
      grpcCode === GrpcStatus.INTERNAL
   ) {
      return true;
   }

   // gRPC client status codes (4xx equivalent) are normal business outcomes -> NOT failures
   if (typeof grpcCode === 'number' && NON_RETRYABLE_GRPC_STATUS_CODES.includes(grpcCode)) {
      return false;
   }

   // Raw Node network error codes
   const errorCode = (error as { code?: string }).code;
   if (typeof errorCode === 'string' && (NETWORK_ERROR_CODES as readonly string[]).includes(errorCode)) {
      return true;
   }

   // Extract parsed status/errorCode from serialized gRPC details or message
   const detailsStr =
      typeof (error as { details?: unknown }).details === 'string' ? (error as { details: string }).details : undefined;
   const msgStr = error instanceof Error ? error.message : '';
   const jsonCandidate =
      detailsStr ||
      (msgStr.includes('{') && msgStr.includes('}')
         ? msgStr.slice(msgStr.indexOf('{'), msgStr.lastIndexOf('}') + 1)
         : undefined);

   let parsedStatusCode: number | undefined = undefined;
   let parsedErrorCode: string | undefined = undefined;

   if (jsonCandidate) {
      try {
         const parsed = JSON.parse(jsonCandidate) as { statusCode?: number; errorCode?: string };
         if (typeof parsed.statusCode === 'number') {
            parsedStatusCode = parsed.statusCode;
         }
         if (typeof parsed.errorCode === 'string') {
            parsedErrorCode = parsed.errorCode;
         }
      } catch {
         // ignore
      }
   }

   // Check HTTP status code
   const rawStatus =
      parsedStatusCode ??
      ((error as { getStatus?: () => number; statusCode?: number; status?: number }).getStatus
         ? (error as { getStatus: () => number }).getStatus()
         : (error as { statusCode?: number; status?: number }).statusCode || (error as { status?: number }).status);

   if (typeof rawStatus === 'number') {
      if (
         rawStatus >= HTTP_STATUS_THRESHOLDS.SERVER_ERROR_MIN ||
         rawStatus === HTTP_STATUS_THRESHOLDS.REQUEST_TIMEOUT
      ) {
         return true;
      }
      if (rawStatus >= HTTP_STATUS_THRESHOLDS.CLIENT_ERROR_MIN && rawStatus < HTTP_STATUS_THRESHOLDS.SERVER_ERROR_MIN) {
         return false;
      }
   }

   // Known standard client business error codes are not failures
   if (parsedErrorCode && (CLIENT_COMMON_ERROR_CODES as readonly string[]).includes(parsedErrorCode)) {
      return false;
   }

   // gRPC error message heuristics
   if (error instanceof Error && SERVICE_FAILURE_KEYWORDS.some((keyword) => error.message.includes(keyword))) {
      return true;
   }

   // Business AppException subclasses (4xx) are not failures
   if (error instanceof AppException) {
      return false;
   }

   // All other unhandled errors are treated as service failures
   return true;
};

interface CallRecord {
   timestamp: number;
   isFailure: boolean;
}

/**
 * Production-ready Circuit Breaker implementation following GoF State & Cloud Resilience Patterns.
 * Protects caller from cascading failures when downstream microservices are down or experiencing latency.
 */
export class CircuitBreaker {
   private readonly logger: Logger;
   public readonly name: string;
   private readonly failureThreshold: number;
   private readonly successThreshold: number;
   private readonly callTimeoutMs: number;
   private readonly resetTimeoutMs: number;
   private readonly isFailureFn: (error: unknown) => boolean;
   private readonly onStateChangeFn?: (from: CircuitState, to: CircuitState, name: string) => void;

   private readonly slidingWindowType: SlidingWindowType;
   private readonly slidingWindowSize: number;
   private readonly slidingWindowDurationMs: number;
   private readonly minimumNumberOfCalls: number;
   private readonly failureRateThreshold: number;
   private windowRecords: CallRecord[] = [];

   private state: CircuitState = CircuitState.CLOSED;
   private failureCount = 0;
   private consecutiveSuccesses = 0;
   private lastFailureTime?: number;
   private lastSuccessTime?: number;
   private lastStateChangeTime: number = Date.now();
   private nextAttemptTime?: number;
   private halfOpenProbeInFlight = false;

   private totalExecutions = 0;
   private totalFailures = 0;
   private totalSuccesses = 0;
   private totalShortCircuits = 0;

   constructor(options: CircuitBreakerOptions = {}) {
      this.name = options.name || 'CircuitBreaker';
      this.failureThreshold = options.failureThreshold ?? CIRCUIT_BREAKER_DEFAULTS.FAILURE_THRESHOLD;
      this.successThreshold = options.successThreshold ?? CIRCUIT_BREAKER_DEFAULTS.SUCCESS_THRESHOLD;
      this.callTimeoutMs = options.timeout ?? CIRCUIT_BREAKER_DEFAULTS.TIMEOUT_MS;
      this.resetTimeoutMs = options.resetTimeout ?? CIRCUIT_BREAKER_DEFAULTS.RESET_TIMEOUT_MS;
      this.isFailureFn = options.isFailure ?? defaultIsFailure;
      this.onStateChangeFn = options.onStateChange;

      this.slidingWindowType = options.slidingWindowType ?? CIRCUIT_BREAKER_DEFAULTS.SLIDING_WINDOW_TYPE;
      this.slidingWindowSize = options.slidingWindowSize ?? CIRCUIT_BREAKER_DEFAULTS.SLIDING_WINDOW_SIZE;
      this.slidingWindowDurationMs =
         options.slidingWindowDurationMs ?? CIRCUIT_BREAKER_DEFAULTS.SLIDING_WINDOW_DURATION_MS;
      this.minimumNumberOfCalls = options.minimumNumberOfCalls ?? CIRCUIT_BREAKER_DEFAULTS.MINIMUM_NUMBER_OF_CALLS;
      this.failureRateThreshold = options.failureRateThreshold ?? CIRCUIT_BREAKER_DEFAULTS.FAILURE_RATE_THRESHOLD;

      this.logger = new Logger(`CircuitBreaker:${this.name}`);
   }

   /**
    * Executes an async operation protected by timeout and the circuit breaker state machine.
    */
   async execute<T>(fn: () => Promise<T>, fallback?: (error: Error) => Promise<T> | T): Promise<T> {
      this.totalExecutions++;

      // 1. Check and handle OPEN state
      if (this.state === CircuitState.OPEN) {
         const now = Date.now();
         if (this.nextAttemptTime && now >= this.nextAttemptTime) {
            this.transitionTo(CircuitState.HALF_OPEN);
         } else {
            this.totalShortCircuits++;
            const openError = new CircuitBreakerOpenException(this.name, this.resetTimeoutMs);
            if (fallback) {
               return await fallback(openError);
            }
            throw openError;
         }
      }

      // 2. Check and handle HALF_OPEN probe concurrency
      if (this.state === CircuitState.HALF_OPEN) {
         if (this.halfOpenProbeInFlight) {
            this.totalShortCircuits++;
            const busyError = new CircuitBreakerOpenException(this.name, this.resetTimeoutMs);
            if (fallback) {
               return await fallback(busyError);
            }
            throw busyError;
         }
         this.halfOpenProbeInFlight = true;
      }

      // 3. Execute with per-call timeout
      try {
         const result = await this.executeWithTimeout(fn);
         this.handleSuccess();
         return result;
      } catch (error: unknown) {
         const isFailure = this.isFailureFn(error);
         if (isFailure) {
            this.handleFailure(error);
         } else if (this.state === CircuitState.HALF_OPEN) {
            // A non-failure business response (e.g. 400 Bad Request) proves downstream is alive
            this.handleSuccess();
         }

         if (fallback) {
            return await fallback(error instanceof Error ? error : new Error(String(error)));
         }
         throw error;
      }
   }

   /**
    * Executes an RxJS Observable with per-call timeout and circuit breaker protection.
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

   private async executeWithTimeout<T>(fn: () => Promise<T>): Promise<T> {
      if (this.callTimeoutMs <= 0) {
         return await fn();
      }

      let timer: NodeJS.Timeout | undefined;
      const timeoutPromise = new Promise<never>((_, reject) => {
         timer = setTimeout(() => {
            reject(
               new TimeoutException(COMMON_ERROR_CODES.TIMEOUT, {
                  params: {
                     service: this.name,
                     timeoutMs: this.callTimeoutMs,
                  },
               }),
            );
         }, this.callTimeoutMs);
         timer.unref?.();
      });

      try {
         return await Promise.race([fn(), timeoutPromise]);
      } finally {
         if (timer) {
            clearTimeout(timer);
         }
      }
   }

   private handleSuccess(): void {
      this.totalSuccesses++;
      this.lastSuccessTime = Date.now();

      if (this.state === CircuitState.HALF_OPEN) {
         this.halfOpenProbeInFlight = false;
         this.consecutiveSuccesses++;
         if (this.consecutiveSuccesses >= this.successThreshold) {
            this.transitionTo(CircuitState.CLOSED);
         }
      } else if (this.state === CircuitState.CLOSED) {
         this.failureCount = 0;
         this.recordCall(false);
      }
   }

   private handleFailure(error: unknown): void {
      this.totalFailures++;
      this.lastFailureTime = Date.now();

      if (this.state === CircuitState.HALF_OPEN) {
         this.halfOpenProbeInFlight = false;
         this.transitionTo(CircuitState.OPEN);
      } else if (this.state === CircuitState.CLOSED) {
         this.failureCount++;
         this.recordCall(true);
         this.evaluateFailureThresholds();
      }

      this.logger.warn(
         `Call failed [${this.state}]: ${error instanceof Error ? error.message : String(error)}. FailureCount=${this.failureCount}/${this.failureThreshold}`,
      );
   }

   private recordCall(isFailure: boolean): void {
      const now = Date.now();
      this.windowRecords.push({ timestamp: now, isFailure });

      if (this.slidingWindowType === SLIDING_WINDOW_TYPES.COUNT_BASED) {
         if (this.windowRecords.length > this.slidingWindowSize) {
            this.windowRecords.shift();
         }
      } else {
         const cutoff = now - this.slidingWindowDurationMs;
         this.windowRecords = this.windowRecords.filter((r) => r.timestamp >= cutoff);
      }
   }

   private evaluateFailureThresholds(): void {
      // 1. Immediate trip on consecutive failures (fast fail / safety floor)
      if (this.failureCount >= this.failureThreshold) {
         this.transitionTo(CircuitState.OPEN);
         return;
      }

      // 2. Sliding window failure rate calculation
      if (this.slidingWindowType === SLIDING_WINDOW_TYPES.TIME_BASED) {
         const cutoff = Date.now() - this.slidingWindowDurationMs;
         this.windowRecords = this.windowRecords.filter((r) => r.timestamp >= cutoff);
      }

      const totalCallsInWindow = this.windowRecords.length;
      if (totalCallsInWindow >= this.minimumNumberOfCalls) {
         const failedCalls = this.windowRecords.filter((r) => r.isFailure).length;
         const failureRate = (failedCalls / totalCallsInWindow) * 100;
         if (failureRate >= this.failureRateThreshold) {
            this.logger.warn(
               `Circuit tripped OPEN: Failure rate ${failureRate.toFixed(1)}% (${failedCalls}/${totalCallsInWindow} calls) exceeded threshold ${this.failureRateThreshold}%`,
            );
            this.transitionTo(CircuitState.OPEN);
         }
      }
   }

   private transitionTo(newState: CircuitState): void {
      const oldState = this.state;
      if (oldState === newState) return;

      this.state = newState;
      this.lastStateChangeTime = Date.now();

      if (newState === CircuitState.OPEN) {
         this.nextAttemptTime = Date.now() + this.resetTimeoutMs;
         this.halfOpenProbeInFlight = false;
         this.consecutiveSuccesses = 0;
         this.windowRecords = [];
         this.logger.error(`Circuit tripped OPEN! Downstream calls short-circuited for ${this.resetTimeoutMs}ms.`);
      } else if (newState === CircuitState.HALF_OPEN) {
         this.nextAttemptTime = undefined;
         this.consecutiveSuccesses = 0;
         this.halfOpenProbeInFlight = false;
         this.logger.log(`Circuit entered HALF_OPEN. Allowing probe requests.`);
      } else if (newState === CircuitState.CLOSED) {
         this.failureCount = 0;
         this.consecutiveSuccesses = 0;
         this.nextAttemptTime = undefined;
         this.halfOpenProbeInFlight = false;
         this.windowRecords = [];
         this.logger.log(`Circuit recovered to CLOSED. Normal traffic resumed.`);
      }

      if (this.onStateChangeFn) {
         try {
            this.onStateChangeFn(oldState, newState, this.name);
         } catch (e) {
            this.logger.error(`Error in onStateChange callback: ${e instanceof Error ? e.message : String(e)}`);
         }
      }
   }

   getState(): CircuitState {
      // Check for passive transition if OPEN and cooldown has elapsed
      if (this.state === CircuitState.OPEN && this.nextAttemptTime && Date.now() >= this.nextAttemptTime) {
         this.transitionTo(CircuitState.HALF_OPEN);
      }
      return this.state;
   }

   isOpen(): boolean {
      return this.getState() === CircuitState.OPEN;
   }

   isClosed(): boolean {
      return this.getState() === CircuitState.CLOSED;
   }

   isHalfOpen(): boolean {
      return this.getState() === CircuitState.HALF_OPEN;
   }

   getStats(): CircuitBreakerStats {
      let records = this.windowRecords;
      if (this.slidingWindowType === SLIDING_WINDOW_TYPES.TIME_BASED) {
         const cutoff = Date.now() - this.slidingWindowDurationMs;
         records = records.filter((r) => r.timestamp >= cutoff);
      }
      const callsInWindow = records.length;
      const failuresInWindow = records.filter((r) => r.isFailure).length;
      const failureRate = callsInWindow > 0 ? (failuresInWindow / callsInWindow) * 100 : 0;

      return {
         name: this.name,
         state: this.getState(),
         failureCount: this.failureCount,
         consecutiveSuccesses: this.consecutiveSuccesses,
         lastFailureTime: this.lastFailureTime,
         lastSuccessTime: this.lastSuccessTime,
         lastStateChangeTime: this.lastStateChangeTime,
         nextAttemptTime: this.nextAttemptTime,
         totalExecutions: this.totalExecutions,
         totalFailures: this.totalFailures,
         totalSuccesses: this.totalSuccesses,
         totalShortCircuits: this.totalShortCircuits,
         slidingWindowType: this.slidingWindowType,
         callsInWindow,
         failuresInWindow,
         failureRate,
      };
   }

   reset(): void {
      this.windowRecords = [];
      this.transitionTo(CircuitState.CLOSED);
   }

   trip(): void {
      this.transitionTo(CircuitState.OPEN);
   }
}

/**
 * RxJS Operator for wrapping microservice/gRPC client Observables with Circuit Breaker resilience.
 */
export function withCircuitBreaker<T>(
   breaker: CircuitBreaker,
   fallback?: (error: Error) => Observable<T> | Promise<T> | T,
): MonoTypeOperatorFunction<T> {
   return (source$: Observable<T>) => {
      return breaker.executeObservable(source$, fallback);
   };
}

/**
 * Registry / Factory pattern to manage, reuse, and inspect CircuitBreaker instances across OmniServices.
 */
export class CircuitBreakerRegistry {
   private static readonly instances = new Map<string, CircuitBreaker>();

   static getOrCreate(name: string, options?: Omit<CircuitBreakerOptions, 'name'>): CircuitBreaker {
      let breaker = this.instances.get(name);
      if (!breaker) {
         breaker = new CircuitBreaker({ ...options, name });
         this.instances.set(name, breaker);
      }
      return breaker;
   }

   static get(name: string): CircuitBreaker | undefined {
      return this.instances.get(name);
   }

   static getAll(): Map<string, CircuitBreaker> {
      return new Map(this.instances);
   }

   static clear(): void {
      this.instances.clear();
   }
}
