/**
 * Cache namespaces for logical key organization and collision prevention across microservices.
 * Keys in Redis follow the pattern `{namespace}:{key}`.
 */
export enum CacheNamespace {
   AUTH = 'auth',
   USER = 'user',
   GATEWAY = 'gateway',
   SESSION = 'session',
   RATE_LIMIT = 'rate_limit',
   PRODUCT = 'product',
}
