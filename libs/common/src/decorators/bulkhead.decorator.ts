import { BulkheadOptions, BulkheadRegistry } from '@common/patterns/bulkhead.pattern';

/**
 * Method decorator that wraps async class methods with the Bulkhead concurrency limiter pattern.
 * Limits the number of concurrent executions to prevent downstream resource starvation and Event Loop saturation.
 *
 * @param options - Bulkhead configuration or bulkhead name
 *
 * @example
 * ```typescript
 * class SearchService {
 *    @UseBulkhead({
 *       name: 'search-grpc-bulkhead',
 *       maxConcurrent: 50,
 *       maxQueueCapacity: 100,
 *       queueTimeoutMs: 1000,
 *    })
 *    async search(query: string) {
 *       return await this.searchGrpcService.search({ query });
 *    }
 * }
 * ```
 */
export function UseBulkhead(options: BulkheadOptions | string = {}): MethodDecorator {
   return (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
      const originalMethod = descriptor.value as (...args: unknown[]) => Promise<unknown>;
      if (typeof originalMethod !== 'function') {
         return descriptor;
      }

      const defaultName = `${target.constructor?.name || 'Target'}.${String(propertyKey)}`;
      const bulkheadName = typeof options === 'string' ? options : options.name || defaultName;
      const bulkheadOptions: BulkheadOptions =
         typeof options === 'string' ? { name: bulkheadName } : { ...options, name: bulkheadName };

      const bulkhead = BulkheadRegistry.getOrCreate(bulkheadName, bulkheadOptions);

      descriptor.value = async function (this: unknown, ...args: unknown[]) {
         return bulkhead.execute(() => originalMethod.apply(this, args));
      };

      return descriptor;
   };
}
