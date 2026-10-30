import { ProductModerationHistoryEntity } from '@product/entities';

export const PRODUCT_MODERATION_HISTORY_REPOSITORY = Symbol('PRODUCT_MODERATION_HISTORY_REPOSITORY');

export interface CreateProductModerationHistoryInput {
   historyId?: string;
   productId: string;
   moderatorId: string;
   moderatorEmail?: string | null;
   action: string;
   previousStatus: string;
   newStatus: string;
   rejectionReason?: string | null;
   moderationNotes?: string | null;
   snapshot?: Record<string, unknown> | null;
}

export interface IProductModerationHistoryRepository {
   create(input: CreateProductModerationHistoryInput): Promise<ProductModerationHistoryEntity>;
   findByProductId(productId: string): Promise<ProductModerationHistoryEntity[]>;
}
