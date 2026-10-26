import { ProductVariantEntity } from '@product/entities';

export const PRODUCT_VARIANT_REPOSITORY = Symbol('PRODUCT_VARIANT_REPOSITORY');

export interface CreateVariantInput {
   variantId?: string;
   productId: string;
   sku: string;
   variantName: string;
   unit: string;
   packSize?: string;
   price: number;
   originalPrice?: number;
   currency?: string;
   stockQuantity: number;
   lowStockThreshold?: number;
   isDefault?: boolean;
   status?: string;
}

export interface UpdateVariantInput {
   variantName?: string;
   unit?: string;
   packSize?: string;
   price?: number;
   originalPrice?: number;
   currency?: string;
   stockQuantity?: number;
   reservedQuantity?: number;
   lowStockThreshold?: number;
   isDefault?: boolean;
   status?: string;
}

export interface IProductVariantRepository {
   findById(variantId: string): Promise<ProductVariantEntity | null>;
   findByIds(variantIds: string[]): Promise<ProductVariantEntity[]>;
   findBySku(sku: string): Promise<ProductVariantEntity | null>;
   findByProductId(productId: string): Promise<ProductVariantEntity[]>;
   create(input: CreateVariantInput): Promise<ProductVariantEntity>;
   createMany(inputs: CreateVariantInput[]): Promise<ProductVariantEntity[]>;
   update(variantId: string, input: UpdateVariantInput): Promise<ProductVariantEntity>;
   adjustStock(variantId: string, quantityDelta: number): Promise<ProductVariantEntity>;
   reserveStock(variantId: string, quantity: number): Promise<ProductVariantEntity | null>;
   releaseStock(variantId: string, quantity: number): Promise<ProductVariantEntity>;
}
