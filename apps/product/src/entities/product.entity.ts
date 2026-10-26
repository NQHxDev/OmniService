import { ProductVariantEntity } from './product-variant.entity';
import { WhoCategoryEntity } from './who-category.entity';

export class ProductEntity {
   productId!: string;
   supplierId!: string;
   whoCategoryCode!: string;
   productName!: string;
   normalizedName!: string;
   productSlug!: string;
   description!: string;
   origin?: string | null;
   storageCondition?: string | null;
   shelfLifeDays?: number | null;
   images!: string[];
   status!: string;
   moderationStatus!: string;
   rejectionReason?: string | null;
   moderatedBy?: string | null;
   moderatedAt?: Date | null;
   version!: number;
   deletedAt?: Date | null;
   createdAt!: Date;
   updatedAt!: Date;

   whoCategory?: WhoCategoryEntity;
   variants?: ProductVariantEntity[];
}
