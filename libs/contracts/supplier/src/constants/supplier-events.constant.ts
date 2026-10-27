export const SUPPLIER_EVENTS = {
   SUPPLIER_REGISTERED: 'supplier.registered',
   SUPPLIER_ONBOARDING_COMPLETED: 'supplier.onboarding.completed',
   SUPPLIER_UPDATED: 'supplier.updated',
   SUPPLIER_KYB_SUBMITTED: 'supplier.kyb_submitted',
   SUPPLIER_VERIFIED: 'supplier.verified',
   SUPPLIER_REJECTED: 'supplier.rejected',
   SUPPLIER_STATUS_CHANGED: 'supplier.status_changed',
} as const;

export type SupplierEvent = (typeof SUPPLIER_EVENTS)[keyof typeof SUPPLIER_EVENTS];
