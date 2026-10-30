export const OFFER_STATUS = {
   AVAILABLE: 'AVAILABLE',
   OUT_OF_STOCK: 'OUT_OF_STOCK',
   DISCONTINUED: 'DISCONTINUED',
} as const;

export type OfferStatusType = (typeof OFFER_STATUS)[keyof typeof OFFER_STATUS];

export enum OfferStatusEnum {
   AVAILABLE = 'AVAILABLE',
   OUT_OF_STOCK = 'OUT_OF_STOCK',
   DISCONTINUED = 'DISCONTINUED',
}

export const INGREDIENT_STATUS = {
   ACTIVE: 'ACTIVE',
   INACTIVE: 'INACTIVE',
   DRAFT: 'DRAFT',
} as const;

export type IngredientStatusType = (typeof INGREDIENT_STATUS)[keyof typeof INGREDIENT_STATUS];

export enum IngredientStatusEnum {
   ACTIVE = 'ACTIVE',
   INACTIVE = 'INACTIVE',
   DRAFT = 'DRAFT',
}

export const SUPPLIER_STATUS = {
   ACTIVE: 'ACTIVE',
   PENDING: 'PENDING',
   UNDER_REVIEW: 'UNDER_REVIEW',
   REJECTED: 'REJECTED',
   SUSPENDED: 'SUSPENDED',
} as const;

export type SupplierStatusType = (typeof SUPPLIER_STATUS)[keyof typeof SUPPLIER_STATUS];

export enum SupplierStatusEnum {
   ACTIVE = 'ACTIVE',
   PENDING = 'PENDING',
   UNDER_REVIEW = 'UNDER_REVIEW',
   REJECTED = 'REJECTED',
   SUSPENDED = 'SUSPENDED',
}
