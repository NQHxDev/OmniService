export const PRODUCT_EVENTS = {
   REGISTERED: 'product.event.registered',
   APPROVED: 'product.event.approved',
   REJECTED: 'product.event.rejected',
   UPDATED: 'product.event.updated',
   STATUS_CHANGED: 'product.event.status_changed',
   DELETED: 'product.event.deleted',
   STOCK_RESERVED: 'product.event.stock_reserved',
   STOCK_RELEASED: 'product.event.stock_released',
   STOCK_ADJUSTED: 'product.event.stock_adjusted',
} as const;

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
   moderationStatus: string;
   rejectionReason?: string;
   moderatedBy?: string;
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
