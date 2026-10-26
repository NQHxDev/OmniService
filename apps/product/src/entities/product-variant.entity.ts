export class ProductVariantEntity {
   variantId!: string;
   productId!: string;
   sku!: string;
   variantName!: string;
   unit!: string;
   packSize?: string | null;
   price!: number;
   originalPrice?: number | null;
   currency!: string;
   stockQuantity!: number;
   reservedQuantity!: number;
   lowStockThreshold!: number;
   isDefault!: boolean;
   status!: string;
   version!: number;
   deletedAt?: Date | null;
   createdAt!: Date;
   updatedAt!: Date;
}
