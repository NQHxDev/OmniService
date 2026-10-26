export const SERVICE_NAMES = {
   GATEWAY: 'api-gateway',
   AUTH: 'auth-service',
   USER: 'user-service',
   ORDER: 'order-service',
   NOTIFICATION: 'notification-service',
   POST: 'post-service',
   SEARCH: 'search-service',
   MEDIA: 'media-service',
   COMMERCE: 'commerce-service',
   SUPPLIER: 'supplier-service',
   PAYMENT: 'payment-service',
   PRODUCT: 'product-service',
} as const;

export type ServiceName = (typeof SERVICE_NAMES)[keyof typeof SERVICE_NAMES];

export const GRPC_CLIENTS = {
   AUTH_V1: 'AUTH_V1_GRPC_CLIENT',
   USER_V1: 'USER_V1_GRPC_CLIENT',
   SUPPLIER_V1: 'SUPPLIER_V1_GRPC_CLIENT',
   SEARCH_V1: 'SEARCH_V1_GRPC_CLIENT',
   MEDIA_V1: 'MEDIA_V1_GRPC_CLIENT',
   COMMERCE_V1: 'COMMERCE_V1_GRPC_CLIENT',
   ORDER_V1: 'ORDER_V1_GRPC_CLIENT',
   PAYMENT_V1: 'PAYMENT_V1_GRPC_CLIENT',
   PRODUCT_V1: 'PRODUCT_V1_GRPC_CLIENT',
   HEALTH_V1: 'HEALTH_V1_GRPC_CLIENT',
} as const;

export type GrpcClientToken = (typeof GRPC_CLIENTS)[keyof typeof GRPC_CLIENTS];

export const GRPC_SERVICE_NAMES = {
   AUTH: 'AuthService',
   USER: 'UserService',
   SUPPLIER: 'SupplierService',
   SEARCH: 'SearchService',
   MEDIA: 'MediaService',
   COMMERCE: 'CommerceService',
   ORDER: 'OrderService',
   PAYMENT: 'PaymentService',
   PRODUCT: 'ProductService',
   HEALTH: 'HealthService',
} as const;

export type GrpcServiceName = (typeof GRPC_SERVICE_NAMES)[keyof typeof GRPC_SERVICE_NAMES];
