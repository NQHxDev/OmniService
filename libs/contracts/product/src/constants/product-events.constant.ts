export const PRODUCT_EVENTS = {
   REGISTERED: 'product.event.registered',
   APPROVED: 'product.event.approved',
   REJECTED: 'product.event.rejected',
   SUSPENDED: 'product.event.suspended',
   UPDATED: 'product.event.updated',
   STATUS_CHANGED: 'product.event.status_changed',
   DELETED: 'product.event.deleted',
   STOCK_RESERVED: 'product.event.stock_reserved',
   STOCK_RELEASED: 'product.event.stock_released',
   STOCK_ADJUSTED: 'product.event.stock_adjusted',
} as const;

export const PRODUCT_AGGREGATE_TYPE = 'PRODUCT' as const;

export const PRODUCT_OUTBOX_EVENTS = {
   APPROVED: 'PRODUCT_APPROVED',
   REJECTED: 'PRODUCT_REJECTED',
   SUSPENDED: 'PRODUCT_SUSPENDED',
   REGISTERED: 'PRODUCT_REGISTERED',
   STATUS_CHANGED: 'PRODUCT_STATUS_CHANGED',
} as const;

export type ProductOutboxEventType = (typeof PRODUCT_OUTBOX_EVENTS)[keyof typeof PRODUCT_OUTBOX_EVENTS];

export type ProductEvent = (typeof PRODUCT_EVENTS)[keyof typeof PRODUCT_EVENTS];

export interface ProductVariantPayload {
   variantId: string;
   sku: string;
   variantName: string;
   unit: string;
   packSize?: string;
   price: number;
   originalPrice?: number;
   currency?: string;
   stockQuantity: number;
   lowStockThreshold?: number;
   isDefault: boolean;
   status?: string;
}

export interface ProductRegisteredEventPayload {
   productId: string;
   supplierId: string;
   whoCategoryCode: string;
   productName: string;
   normalizedName?: string;
   productSlug: string;
   description: string;
   origin?: string;
   storageCondition?: string;
   shelfLifeDays?: number;
   images: string[];
   status: string;
   moderationStatus: string;
   minPrice?: number;
   maxPrice?: number;
   variants: ProductVariantPayload[];
   createdAt: string;
}

export interface ProductModeratedEventPayload {
   productId: string;
   supplierId: string;
   productName?: string;
   moderationStatus: string;
   action?: string;
   rejectionReason?: string;
   moderationNotes?: string;
   moderatedBy?: string;
   moderatorEmail?: string;
   moderatedAt: string;
}

export interface ProductStockAdjustedEventPayload {
   productId: string;
   variantId: string;
   sku: string;
   previousStock?: number;
   delta?: number;
   newStock: number;
   movementType: string;
   quantity?: number;
   reason?: string;
   timestamp: string;
}
