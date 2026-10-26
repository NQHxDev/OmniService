export const PRODUCT_STATUS = {
   DRAFT: 'DRAFT',
   ACTIVE: 'ACTIVE',
   INACTIVE: 'INACTIVE',
} as const;

export type ProductStatusType = (typeof PRODUCT_STATUS)[keyof typeof PRODUCT_STATUS];

export const MODERATION_STATUS = {
   PENDING_APPROVAL: 'PENDING_APPROVAL',
   APPROVED: 'APPROVED',
   REJECTED: 'REJECTED',
} as const;

export type ModerationStatusType = (typeof MODERATION_STATUS)[keyof typeof MODERATION_STATUS];

export const VARIANT_STATUS = {
   AVAILABLE: 'AVAILABLE',
   OUT_OF_STOCK: 'OUT_OF_STOCK',
   DISCONTINUED: 'DISCONTINUED',
} as const;

export type VariantStatusType = (typeof VARIANT_STATUS)[keyof typeof VARIANT_STATUS];

export const STOCK_MOVEMENT_TYPE = {
   INBOUND: 'INBOUND',
   OUTBOUND: 'OUTBOUND',
   RESERVE: 'RESERVE',
   RELEASE: 'RELEASE',
   ADJUSTMENT: 'ADJUSTMENT',
} as const;

export type StockMovementType = (typeof STOCK_MOVEMENT_TYPE)[keyof typeof STOCK_MOVEMENT_TYPE];

export const CURRENCY = {
   VND: 'VND',
   USD: 'USD',
} as const;

export type CurrencyType = (typeof CURRENCY)[keyof typeof CURRENCY];
