import { ProductEntity } from '@product/entities';

export const PRODUCT_REPOSITORY = Symbol('PRODUCT_REPOSITORY');

export interface FindProductsParams {
   supplierId?: string;
   whoCategoryCode?: string;
   status?: string;
   moderationStatus?: string;
   search?: string;
   limit?: number;
   offset?: number;
}

export interface CreateProductInput {
   productId?: string;
   supplierId: string;
   whoCategoryCode: string;
   productName: string;
   normalizedName: string;
   productSlug: string;
   description: string;
   origin?: string;
   storageCondition?: string;
   shelfLifeDays?: number;
   images?: string[];
   status?: string;
   moderationStatus?: string;
}

export interface UpdateProductInput {
   productName?: string;
   normalizedName?: string;
   productSlug?: string;
   description?: string;
   origin?: string;
   storageCondition?: string;
   shelfLifeDays?: number;
   images?: string[];
   status?: string;
   moderationStatus?: string;
   rejectionReason?: string | null;
   moderatedBy?: string | null;
   moderatedAt?: Date | null;
}

export interface IProductRepository {
   findById(productId: string): Promise<ProductEntity | null>;
   findByIds(productIds: string[]): Promise<ProductEntity[]>;
   findBySlug(productSlug: string): Promise<ProductEntity | null>;
   findMany(params: FindProductsParams): Promise<{ items: ProductEntity[]; total: number }>;
   create(input: CreateProductInput): Promise<ProductEntity>;
   update(productId: string, input: UpdateProductInput): Promise<ProductEntity>;
   softDelete(productId: string): Promise<void>;
}
