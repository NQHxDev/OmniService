import { of, throwError } from 'rxjs';
import { BadRequestException, TimeoutException } from '@common/exceptions/http.exceptions';
import {
   CircuitBreaker,
   CircuitBreakerOpenException,
   CircuitBreakerRegistry,
   CircuitState,
   defaultIsFailure,
   NETWORK_ERROR_CODES,
   SLIDING_WINDOW_TYPES,
   withCircuitBreaker,
} from '@common/patterns/circuit-breaker.pattern';
import { GrpcStatus } from '@common/exceptions/grpc.exception';
import { HealthIndicatorStatus } from '@common/constants/health.constant';

const PRIMARY_NETWORK_ERROR = NETWORK_ERROR_CODES[0];

describe('CircuitBreaker Pattern', () => {
   beforeEach(() => {
      CircuitBreakerRegistry.clear();
      jest.clearAllMocks();
   });

   describe('defaultIsFailure', () => {
      it('should return false for null/undefined', () => {
         expect(defaultIsFailure(null)).toBe(false);
         expect(defaultIsFailure(undefined)).toBe(false);
      });

      it('should return true for TimeoutException', () => {
         expect(defaultIsFailure(new TimeoutException())).toBe(true);
      });

      it('should return true for gRPC UNAVAILABLE and DEADLINE_EXCEEDED', () => {
         expect(defaultIsFailure({ code: GrpcStatus.UNAVAILABLE })).toBe(true);
         expect(defaultIsFailure({ code: GrpcStatus.DEADLINE_EXCEEDED })).toBe(true);
      });

      it('should return true for all registered NETWORK_ERROR_CODES', () => {
         for (const code of NETWORK_ERROR_CODES) {
            expect(defaultIsFailure({ code })).toBe(true);
         }
      });

      it('should return false for 4xx BadRequestException', () => {
         expect(defaultIsFailure(new BadRequestException())).toBe(false);
      });

      it('should return true for 5xx status code', () => {
         expect(defaultIsFailure({ statusCode: 503 })).toBe(true);
         expect(defaultIsFailure({ status: 500 })).toBe(true);
      });
   });

   describe('Basic Execution & Timeout', () => {
      it('should execute successfully when circuit is CLOSED', async () => {
         const breaker = new CircuitBreaker({ name: 'test-service' });
         const mockFn = jest.fn().mockResolvedValue('ok');

         const result = await breaker.execute(mockFn);

         expect(result).toBe('ok');
         expect(mockFn).toHaveBeenCalledTimes(1);
         expect(breaker.getState()).toBe(CircuitState.CLOSED);
         expect(breaker.isClosed()).toBe(true);
      });

      it('should timeout and throw TimeoutException when operation hangs', async () => {
         const breaker = new CircuitBreaker({ name: 'test-service', timeout: 50 });
         const hangingFn = () => new Promise((resolve) => setTimeout(resolve, 200));

         await expect(breaker.execute(hangingFn)).rejects.toThrow(TimeoutException);
         expect(breaker.getStats().failureCount).toBe(1);
      });

      it('should not fail on business exceptions (e.g. BadRequestException)', async () => {
         const breaker = new CircuitBreaker({ name: 'test-service', failureThreshold: 2 });
         const badRequestFn = jest.fn().mockRejectedValue(new BadRequestException('Invalid email'));

         await expect(breaker.execute(badRequestFn)).rejects.toThrow(BadRequestException);
         expect(breaker.getStats().failureCount).toBe(0);
         expect(breaker.getState()).toBe(CircuitState.CLOSED);
      });
   });

   describe('State Transitions (CLOSED -> OPEN -> HALF_OPEN -> CLOSED)', () => {
      it('should trip to OPEN after failureThreshold is reached', async () => {
         const onStateChange = jest.fn();
         const breaker = new CircuitBreaker({
            name: 'test-service',
            failureThreshold: 3,
            resetTimeout: 100,
            onStateChange,
         });

         const failingFn = jest.fn().mockRejectedValue(new Error(PRIMARY_NETWORK_ERROR));

         // Attempt 1
         await expect(breaker.execute(failingFn)).rejects.toThrow(PRIMARY_NETWORK_ERROR);
         expect(breaker.getState()).toBe(CircuitState.CLOSED);

         // Attempt 2
         await expect(breaker.execute(failingFn)).rejects.toThrow(PRIMARY_NETWORK_ERROR);
         expect(breaker.getState()).toBe(CircuitState.CLOSED);

         // Attempt 3: should trip OPEN
         await expect(breaker.execute(failingFn)).rejects.toThrow(PRIMARY_NETWORK_ERROR);
         expect(breaker.getState()).toBe(CircuitState.OPEN);
         expect(breaker.isOpen()).toBe(true);
         expect(onStateChange).toHaveBeenCalledWith(CircuitState.CLOSED, CircuitState.OPEN, 'test-service');
      });

      it('should fail-fast in OPEN state without calling the target function', async () => {
         const breaker = new CircuitBreaker({
            name: 'test-service',
            failureThreshold: 1,
            resetTimeout: 1000,
         });

         const failingFn = jest.fn().mockRejectedValue(new Error(HealthIndicatorStatus.DOWN));
         await expect(breaker.execute(failingFn)).rejects.toThrow(HealthIndicatorStatus.DOWN);
         expect(breaker.isOpen()).toBe(true);

         // Subsequent calls should fail fast in OPEN state
         const targetFn = jest.fn().mockResolvedValue('success');
         await expect(breaker.execute(targetFn)).rejects.toThrow(CircuitBreakerOpenException);
         expect(targetFn).not.toHaveBeenCalled();
         expect(breaker.getStats().totalShortCircuits).toBe(1);
      });

      it('should use fallback when circuit is OPEN or when call fails', async () => {
         const breaker = new CircuitBreaker({
            name: 'test-service',
            failureThreshold: 1,
            resetTimeout: 1000,
         });

         const fallbackFn = jest.fn().mockReturnValue('fallback-response');
         breaker.trip();

         const result = await breaker.execute(() => Promise.resolve('ok'), fallbackFn);
         expect(result).toBe('fallback-response');
         expect(fallbackFn).toHaveBeenCalled();
      });

      it('should recover from OPEN to HALF_OPEN after resetTimeout, and to CLOSED after successThreshold', async () => {
         const onStateChange = jest.fn();
         const breaker = new CircuitBreaker({
            name: 'test-service',
            failureThreshold: 1,
            successThreshold: 2,
            resetTimeout: 50,
            onStateChange,
         });

         // 1. Force trip to OPEN
         breaker.trip();
         expect(breaker.isOpen()).toBe(true);

         // 2. Wait for cooldown resetTimeout
         await new Promise((resolve) => setTimeout(resolve, 60));

         // 3. First probe call in HALF_OPEN
         const probeResult1 = await breaker.execute(() => Promise.resolve('probe1'));
         expect(probeResult1).toBe('probe1');
         expect(breaker.isHalfOpen()).toBe(true);

         // 4. Second probe call to reach successThreshold (2)
         const probeResult2 = await breaker.execute(() => Promise.resolve('probe2'));
         expect(probeResult2).toBe('probe2');
         expect(breaker.isClosed()).toBe(true);
         expect(onStateChange).toHaveBeenCalledWith(CircuitState.HALF_OPEN, CircuitState.CLOSED, 'test-service');
      });

      it('should re-trip to OPEN if probe in HALF_OPEN fails', async () => {
         const breaker = new CircuitBreaker({
            name: 'test-service',
            failureThreshold: 1,
            resetTimeout: 50,
         });

         breaker.trip();
         await new Promise((resolve) => setTimeout(resolve, 60));

         // Probe fails
         await expect(breaker.execute(() => Promise.reject(new Error(HealthIndicatorStatus.DOWN)))).rejects.toThrow(
            HealthIndicatorStatus.DOWN,
         );
         expect(breaker.isOpen()).toBe(true);
      });

      it('should short-circuit concurrent calls in HALF_OPEN while probe is in flight', async () => {
         const breaker = new CircuitBreaker({
            name: 'test-service',
            resetTimeout: 50,
         });

         breaker.trip();
         await new Promise((resolve) => setTimeout(resolve, 60));

         // Slow probe
         let finishProbe!: (val: string) => void;
         const slowProbe = () =>
            new Promise<string>((resolve) => {
               finishProbe = resolve;
            });

         const probePromise = breaker.execute(slowProbe);

         // Concurrent request while probe is in flight
         await expect(breaker.execute(() => Promise.resolve('concurrent'))).rejects.toThrow(
            CircuitBreakerOpenException,
         );

         finishProbe('done');
         await probePromise;
      });
   });

   describe('RxJS Integration', () => {
      it('executeObservable should execute stream correctly', async () => {
         const breaker = new CircuitBreaker({ name: 'test-service' });
         const source$ = of('stream-result');

         const result$ = breaker.executeObservable(source$);
         const res = await new Promise((resolve) => result$.subscribe(resolve));

         expect(res).toBe('stream-result');
      });

      it('executeObservable should handle fallback when error occurs', async () => {
         const breaker = new CircuitBreaker({ name: 'test-service' });
         const source$ = throwError(() => new Error(HealthIndicatorStatus.DOWN));

         const result$ = breaker.executeObservable(source$, () => of('fallback-val'));
         const res = await new Promise((resolve) => result$.subscribe(resolve));

         expect(res).toBe('fallback-val');
      });

      it('withCircuitBreaker operator should work with pipe', async () => {
         const breaker = new CircuitBreaker({ name: 'test-service' });
         const source$ = of(42).pipe(withCircuitBreaker(breaker));

         const res = await new Promise((resolve) => source$.subscribe(resolve));
         expect(res).toBe(42);
      });
   });

   describe('CircuitBreakerRegistry', () => {
      it('should create and retrieve circuit breakers by name', () => {
         const b1 = CircuitBreakerRegistry.getOrCreate('auth-grpc', { timeout: 2000 });
         const b2 = CircuitBreakerRegistry.getOrCreate('auth-grpc');

         expect(b1).toBe(b2);
         expect(b1.name).toBe('auth-grpc');
         expect(CircuitBreakerRegistry.get('auth-grpc')).toBe(b1);
         expect(CircuitBreakerRegistry.getAll().size).toBe(1);
      });

      it('should reset state on manual reset', () => {
         const breaker = CircuitBreakerRegistry.getOrCreate('user-grpc');
         breaker.trip();
         expect(breaker.isOpen()).toBe(true);

         breaker.reset();
         expect(breaker.isClosed()).toBe(true);
      });
   });

   describe('Sliding Window Failure Rate', () => {
      it('should trip OPEN when failure rate exceeds failureRateThreshold with minimumNumberOfCalls', async () => {
         const breaker = new CircuitBreaker({
            name: 'sliding-window-service',
            slidingWindowType: SLIDING_WINDOW_TYPES.COUNT_BASED,
            slidingWindowSize: 10,
            minimumNumberOfCalls: 10,
            failureRateThreshold: 50, // 50%
            failureThreshold: 10, // high consecutive threshold so only rate trips
         });

         const successFn = jest.fn().mockResolvedValue('ok');
         const failureFn = jest.fn().mockRejectedValue(new Error(PRIMARY_NETWORK_ERROR));

         // 5 successes, 4 failures alternating -> 9 calls total (not enough to trip yet)
         for (let i = 0; i < 4; i++) {
            await breaker.execute(successFn);
            await expect(breaker.execute(failureFn)).rejects.toThrow(PRIMARY_NETWORK_ERROR);
         }
         await breaker.execute(successFn);

         expect(breaker.getState()).toBe(CircuitState.CLOSED);
         let stats = breaker.getStats();
         expect(stats.callsInWindow).toBe(9);
         expect(stats.failuresInWindow).toBe(4);
         expect(stats.failureRate).toBeCloseTo((4 / 9) * 100);

         // 10th call: failure -> 5 failures / 10 calls = 50% >= 50% -> trips OPEN!
         await expect(breaker.execute(failureFn)).rejects.toThrow(PRIMARY_NETWORK_ERROR);
         expect(breaker.getState()).toBe(CircuitState.OPEN);
         expect(breaker.isOpen()).toBe(true);

         stats = breaker.getStats();
         expect(stats.totalFailures).toBe(5);
         expect(stats.totalSuccesses).toBe(5);
      });

      it('should not trip when total calls are below minimumNumberOfCalls', async () => {
         const breaker = new CircuitBreaker({
            name: 'min-calls-service',
            slidingWindowType: SLIDING_WINDOW_TYPES.COUNT_BASED,
            slidingWindowSize: 10,
            minimumNumberOfCalls: 5,
            failureRateThreshold: 50,
            failureThreshold: 10,
         });

         const failureFn = jest.fn().mockRejectedValue(new Error(PRIMARY_NETWORK_ERROR));

         // 2 calls failed out of 2 calls = 100% failure rate, but calls (2) < minCalls (5)
         await expect(breaker.execute(failureFn)).rejects.toThrow(PRIMARY_NETWORK_ERROR);
         await expect(breaker.execute(failureFn)).rejects.toThrow(PRIMARY_NETWORK_ERROR);

         expect(breaker.getState()).toBe(CircuitState.CLOSED);
         expect(breaker.getStats().callsInWindow).toBe(2);
         expect(breaker.getStats().failureRate).toBe(100);
      });

      it('should purge expired calls in TIME_BASED sliding window', async () => {
         const breaker = new CircuitBreaker({
            name: 'time-based-service',
            slidingWindowType: SLIDING_WINDOW_TYPES.TIME_BASED,
            slidingWindowDurationMs: 50,
            minimumNumberOfCalls: 2,
            failureRateThreshold: 50,
            failureThreshold: 10,
         });

         const successFn = jest.fn().mockResolvedValue('ok');
         await breaker.execute(successFn);
         expect(breaker.getStats().callsInWindow).toBe(1);

         // Wait for window to expire
         await new Promise((res) => setTimeout(res, 60));

         expect(breaker.getStats().callsInWindow).toBe(0);
         expect(breaker.getStats().failureRate).toBe(0);
      });
   });
});
