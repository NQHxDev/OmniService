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

export const MERCHANT_TYPE = {
   INDIVIDUAL: 'INDIVIDUAL',
   ENTERPRISE: 'ENTERPRISE',
} as const;

export type MerchantType = (typeof MERCHANT_TYPE)[keyof typeof MERCHANT_TYPE];

export enum MerchantTypeEnum {
   INDIVIDUAL = 'INDIVIDUAL',
   ENTERPRISE = 'ENTERPRISE',
}

export const SUPPLIER_MEMBER_STATUS = {
   ACTIVE: 'ACTIVE',
   INVITED: 'INVITED',
   SUSPENDED: 'SUSPENDED',
} as const;

export type SupplierMemberStatusType = (typeof SUPPLIER_MEMBER_STATUS)[keyof typeof SUPPLIER_MEMBER_STATUS];
