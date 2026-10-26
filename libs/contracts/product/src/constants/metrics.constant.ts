export const PRODUCT_METRICS_PREFIX = 'omni_product_';

export const PRODUCT_METRICS_NAMES = {
   GRPC_REQUESTS: 'omni_product_grpc_requests_total',
   GRPC_REQUEST_DURATION: 'omni_product_grpc_request_duration_seconds',
   STOCK_RESERVATIONS: 'omni_product_stock_reservations_total',
   STOCK_ADJUSTMENTS: 'omni_product_stock_adjustments_total',
   OUTBOX_EVENTS_PUBLISHED: 'omni_product_outbox_events_published_total',
} as const;

export const PRODUCT_METRICS_LABELS = {
   SERVICE: 'service',
   METHOD: 'method',
   STATUS: 'status',
   ACTION: 'action',
} as const;

export const PRODUCT_METRICS_BUCKETS = {
   GRPC_REQUEST_DURATION: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
} as const;

export const PRODUCT_METRICS_HELP = {
   GRPC_REQUESTS: 'Total number of gRPC requests handled by product service',
   GRPC_REQUEST_DURATION: 'Product gRPC request latency distribution in seconds',
   STOCK_RESERVATIONS: 'Total number of stock reservations handled',
   STOCK_ADJUSTMENTS: 'Total number of stock adjustments processed',
   OUTBOX_EVENTS_PUBLISHED: 'Total number of outbox events published to message broker',
} as const;
