import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WHO_CATEGORY_CODES, type WhoCategoryCode } from '@contracts/product/constants/product-categories.constant';
import {
   CURRENCY,
   type CurrencyType,
   MODERATION_STATUS,
   type ModerationStatusType,
   PRODUCT_STATUS,
   type ProductStatusType,
} from '@contracts/product/constants/status.constant';
import { ProductVariantDto } from '@contracts/product/dto/product-variant.dto';

export class ProductSearchItemDto {
   @ApiProperty({
      description: 'Unique product identifier UUID',
      example: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
   })
   productId!: string;

   @ApiProperty({
      description: 'ID of the merchant supplier who owns this product',
      example: 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44',
   })
   supplierId!: string;

   @ApiProperty({
      description: 'Standard WHO nutrition group code',
      enum: WHO_CATEGORY_CODES,
      example: WHO_CATEGORY_CODES.STAPLES,
   })
   whoCategoryCode!: WhoCategoryCode;

   @ApiProperty({
      description: 'Ingredient product title',
      example: 'Gạo ST25 Sóc Trăng Đạt Chuẩn GACP',
   })
   productName!: string;

   @ApiProperty({
      description: 'URL-friendly product slug',
      example: 'gao-st25-soc-trang-dat-chuan-gacp',
   })
   productSlug!: string;

   @ApiProperty({
      description: 'Detailed description of the culinary product',
      example: 'Gạo ST25 hảo hạng...',
   })
   description!: string;

   @ApiPropertyOptional({
      description: 'Origin region of cultivation/production',
      example: 'Sóc Trăng',
   })
   origin?: string;

   @ApiProperty({
      description: 'Product media images gallery URLs',
      type: [String],
      example: ['https://storage.omni.io/products/gao-st25.jpg'],
   })
   images!: string[];

   @ApiProperty({
      description: 'Operational status (ACTIVE, INACTIVE, DRAFT)',
      enum: PRODUCT_STATUS,
      example: PRODUCT_STATUS.ACTIVE,
   })
   status!: ProductStatusType;

   @ApiProperty({
      description: 'Admin moderation status (APPROVED, PENDING_APPROVAL, REJECTED)',
      enum: MODERATION_STATUS,
      example: MODERATION_STATUS.APPROVED,
   })
   moderationStatus!: ModerationStatusType;

   @ApiProperty({
      description: 'List of packaging and pricing variants',
      type: [ProductVariantDto],
   })
   variants!: ProductVariantDto[];

   @ApiPropertyOptional({
      description: 'Minimum variant price across all packages',
      example: 180000,
   })
   minPrice?: number;

   @ApiPropertyOptional({
      description: 'Maximum variant price across all packages',
      example: 250000,
   })
   maxPrice?: number;

   @ApiPropertyOptional({
      description: 'Pricing currency',
      enum: CURRENCY,
      example: CURRENCY.VND,
   })
   currency?: CurrencyType;

   @ApiProperty({
      description: 'Creation timestamp ISO-8601',
      example: '2026-09-27T02:15:00.000Z',
   })
   createdAt!: string;

   @ApiProperty({
      description: 'Last update timestamp ISO-8601',
      example: '2026-09-27T02:15:00.000Z',
   })
   updatedAt!: string;
}

export class SearchProductsResponseDto {
   @ApiProperty({
      description: 'Array of products matching search criteria from Elasticsearch',
      type: [ProductSearchItemDto],
   })
   items!: ProductSearchItemDto[];

   @ApiProperty({
      description: 'Total number of matched products found',
      example: 42,
   })
   total!: number;

   @ApiProperty({
      description: 'Pagination limit requested',
      example: 20,
   })
   limit!: number;

   @ApiProperty({
      description: 'Pagination offset applied',
      example: 0,
   })
   offset!: number;
}
