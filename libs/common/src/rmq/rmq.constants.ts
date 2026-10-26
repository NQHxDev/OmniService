export const SERVICES = {
   AUTH_SERVICE: 'AUTH_SERVICE',
   USER_SERVICE: 'USER_SERVICE',
   ORDER_SERVICE: 'ORDER_SERVICE',
   NOTIFICATION_SERVICE: 'NOTIFICATION_SERVICE',
   POST_SERVICE: 'POST_SERVICE',
   SEARCH_SERVICE: 'SEARCH_SERVICE',
   MEDIA_SERVICE: 'MEDIA_SERVICE',
   COMMERCE_SERVICE: 'COMMERCE_SERVICE',
   SUPPLIER_SERVICE: 'SUPPLIER_SERVICE',
   PAYMENT_SERVICE: 'PAYMENT_SERVICE',
   PRODUCT_SERVICE: 'PRODUCT_SERVICE',
} as const;

export const QUEUES = {
   AUTH: 'AUTH_QUEUE',
   USER: 'USER_QUEUE',
   ORDER: 'ORDER_QUEUE',
   NOTIFICATION: 'NOTIFICATION_QUEUE',
   POST: 'POST_QUEUE',
   SEARCH: 'SEARCH_QUEUE',
   MEDIA: 'MEDIA_QUEUE',
   COMMERCE: 'COMMERCE_QUEUE',
   SUPPLIER: 'SUPPLIER_QUEUE',
   PAYMENT: 'PAYMENT_QUEUE',
   PRODUCT: 'PRODUCT_QUEUE',
} as const;

export const RBAC_INTERNAL_PATTERNS = {
   GET_ROLE_PERMISSIONS: 'auth.get_role_permissions',
   SUPPLIER_ONBOARDING_COMPLETED: 'supplier.onboarding.completed',
} as const;

export const RMQ_QUEUE_ARGUMENTS = {
   DEAD_LETTER_EXCHANGE: 'x-dead-letter-exchange',
   DEAD_LETTER_ROUTING_KEY: 'x-dead-letter-routing-key',
   MESSAGE_TTL: 'x-message-ttl',
   MAX_PRIORITY: 'x-max-priority',
} as const;

export const RMQ_HEADERS = {
   RETRY_COUNT: 'x-retry-count',
   LAST_ERROR: 'x-last-error',
   IDEMPOTENCY_KEY: 'x-idempotency-key',
   EVENT_ID: 'x-event-id',
   DEATH: 'x-death',
   FALLBACK_IDEMPOTENCY_KEY: 'idempotency-key',
   FALLBACK_EVENT_ID_CAMEL: 'eventId',
   FALLBACK_EVENT_ID_SNAKE: 'event_id',
} as const;

export const RMQ_IDEMPOTENCY_HEADER_KEYS = [
   RMQ_HEADERS.IDEMPOTENCY_KEY,
   RMQ_HEADERS.EVENT_ID,
   RMQ_HEADERS.FALLBACK_IDEMPOTENCY_KEY,
   RMQ_HEADERS.FALLBACK_EVENT_ID_CAMEL,
   RMQ_HEADERS.FALLBACK_EVENT_ID_SNAKE,
] as const;

export const RMQ_TOPOLOGY_PATTERNS = {
   DLX_EXCHANGE_SUFFIX: '.dlx',
   DLQ_QUEUE_SUFFIX: '_dlq',
   DEAD_LETTER_ROUTING_KEY_SUFFIX: '.dead-letter',
} as const;

export const RMQ_EXCHANGE_TYPES = {
   DIRECT: 'direct',
   FANOUT: 'fanout',
   TOPIC: 'topic',
   HEADERS: 'headers',
} as const;

export const RMQ_RETRY_CONFIG = {
   DEFAULT_MAX_RETRIES: 3,
   DEFAULT_BACKOFF_DELAYS_MS: [5000, 30000, 120000] as const,
   DEFAULT_DIRECT_EXCHANGE: '',
} as const;

export const RMQ_ERROR_ACTIONS = {
   SKIPPED: 'SKIPPED',
   DLQ_POISON: 'DLQ_POISON',
   DLQ_EXHAUSTED: 'DLQ_EXHAUSTED',
   RETRY: 'RETRY',
   REQUEUE: 'REQUEUE',
} as const;

export const RMQ_POISON_NAME_PATTERNS = ['Validation', 'BadRequest', 'NotFound', 'Unauthorized', 'Forbidden'] as const;

export const RMQ_TRANSIENT_SYSTEM_CODES = [
   'ECONNRESET',
   'ECONNREFUSED',
   'ETIMEDOUT',
   'ENOTFOUND',
   'EHOSTUNREACH',
] as const;

export const buildDlxExchangeName = (queue: string): string => `${queue}${RMQ_TOPOLOGY_PATTERNS.DLX_EXCHANGE_SUFFIX}`;

export const buildDlqQueueName = (queue: string): string => `${queue}${RMQ_TOPOLOGY_PATTERNS.DLQ_QUEUE_SUFFIX}`;

export const buildDeadLetterRoutingKey = (queue: string): string =>
   `${queue}${RMQ_TOPOLOGY_PATTERNS.DEAD_LETTER_ROUTING_KEY_SUFFIX}`;

export const buildRetryQueueName = (queue: string, delayMs: number): string => `${queue}_retry_${delayMs}ms`;

export type RmqQueueArgument = (typeof RMQ_QUEUE_ARGUMENTS)[keyof typeof RMQ_QUEUE_ARGUMENTS];
export type RmqHeader = (typeof RMQ_HEADERS)[keyof typeof RMQ_HEADERS];
export type RmqExchangeType = (typeof RMQ_EXCHANGE_TYPES)[keyof typeof RMQ_EXCHANGE_TYPES];
export type RmqErrorAction = (typeof RMQ_ERROR_ACTIONS)[keyof typeof RMQ_ERROR_ACTIONS];

export interface ISupplierOnboardingCompletedEvent {
   accountId: string;
   supplierId: string;
   role: string;
   email?: string;
   supplierName?: string;
}
