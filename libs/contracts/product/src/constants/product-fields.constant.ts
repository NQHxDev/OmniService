export const PRODUCT_FIELDS = {
   PRODUCT_ID: 'productId',
   SUPPLIER_ID: 'supplierId',
   WHO_CATEGORY_CODE: 'whoCategoryCode',
   PRODUCT_NAME: 'productName',
   PRODUCT_SLUG: 'productSlug',
   NORMALIZED_NAME: 'normalizedName',
   DESCRIPTION: 'description',
   ORIGIN: 'origin',
   STORAGE_CONDITION: 'storageCondition',
   SHELF_LIFE_DAYS: 'shelfLifeDays',
   IMAGES: 'images',
   STATUS: 'status',
   MODERATION_STATUS: 'moderationStatus',
   REJECTION_REASON: 'rejectionReason',
   MODERATION_NOTES: 'moderationNotes',
   PENDING_EDIT_DATA: 'pendingEditData',
   VARIANTS: 'variants',
   EDITED_AT: 'editedAt',
} as const;

export type ProductField = (typeof PRODUCT_FIELDS)[keyof typeof PRODUCT_FIELDS];
