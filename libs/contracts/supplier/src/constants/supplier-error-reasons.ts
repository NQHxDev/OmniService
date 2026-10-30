export const SUPPLIER_ERROR_REASONS = {
   EMPTY: 'empty',
   MIN_LENGTH: 'min_length',
   MAX_LENGTH: 'max_length',
   INVALID_LENGTH: 'invalid_length',
   INVALID_CHARACTERS: 'invalid_characters',
   INVALID_FORMAT: 'invalid_format',
   NO_SUPPLIER_STORE: 'no_supplier_store',
   UNVERIFIED_STATUS: 'unverified_status',
} as const;

export type SupplierErrorReason = (typeof SUPPLIER_ERROR_REASONS)[keyof typeof SUPPLIER_ERROR_REASONS];
