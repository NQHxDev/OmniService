import { ApiPropertyOptional } from '@nestjs/swagger';
import { WHO_CATEGORY_CODES, type WhoCategoryCode } from '../constants/product-categories.constant';

export class ProductPendingEditDto {
   @ApiPropertyOptional({ description: 'Updated product name' })
   productName?: string;

   @ApiPropertyOptional({ description: 'Normalized product name' })
   normalizedName?: string;

   @ApiPropertyOptional({ description: 'Product slug' })
   productSlug?: string;

   @ApiPropertyOptional({ description: 'Updated description' })
   description?: string;

   @ApiPropertyOptional({ description: 'Country or region of origin' })
   origin?: string | null;

   @ApiPropertyOptional({ description: 'Storage conditions' })
   storageCondition?: string | null;

   @ApiPropertyOptional({ description: 'Shelf life in days' })
   shelfLifeDays?: number | null;

   @ApiPropertyOptional({ description: 'List of product image URLs', type: [String] })
   images?: string[];

   @ApiPropertyOptional({
      description: 'Standard WHO nutrition group code',
      enum: WHO_CATEGORY_CODES,
   })
   whoCategoryCode?: WhoCategoryCode;

   @ApiPropertyOptional({ description: 'ISO timestamp when draft edit was submitted' })
   editedAt!: string;
}

export type ProductPendingEditData = Partial<ProductPendingEditDto> & {
   [key: string]: unknown;
};
