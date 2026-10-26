export interface IProductVariantProto {
   variantId: string;
   productId: string;
   sku: string;
   variantName: string;
   unit: string;
   packSize?: string;
   price: number;
   originalPrice?: number;
   currency: string;
   stockQuantity: number;
   reservedQuantity: number;
   lowStockThreshold: number;
   isDefault: boolean;
   status: string;
}

export interface IProductProto {
   productId: string;
   supplierId: string;
   whoCategoryCode: string;
   productName: string;
   productSlug: string;
   description: string;
   origin?: string;
   storageCondition?: string;
   shelfLifeDays?: number;
   images: string[];
   status: string;
   moderationStatus: string;
   rejectionReason?: string;
   variants: IProductVariantProto[];
   version: number;
   createdAt: string;
   updatedAt: string;
}

export interface IWhoCategoryProto {
   code: string;
   name: string;
   description: string;
   examples: string;
   order: number;
}
