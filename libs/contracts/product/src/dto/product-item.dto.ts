import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { WhoCategoryCode } from '../constants/product-categories.constant';
import type { ModerationStatusType, ProductStatusType } from '../constants/status.constant';
import { ProductVariantDto } from './product-variant.dto';

export class ProductItemDto {
   @ApiProperty({
      description: 'Unique product identifier',
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
      example: 'STAPLES',
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
      description: 'Origin region',
      example: 'Sóc Trăng',
   })
   origin?: string;

   @ApiPropertyOptional({
      description: 'Storage condition recommendations',
      example: 'Bảo quản nơi khô ráo thoáng mát',
   })
   storageCondition?: string;

   @ApiPropertyOptional({
      description: 'Shelf life period in days',
      example: 180,
   })
   shelfLifeDays?: number;

   @ApiProperty({
      description: 'Gallery image URLs',
      type: [String],
      example: ['https://cdn.omniservices.com/products/gao-st25-front.jpg'],
   })
   images!: string[];

   @ApiProperty({
      description: 'Product lifecycle status',
      example: 'DRAFT',
   })
   status!: ProductStatusType;

   @ApiProperty({
      description: 'Quality and compliance moderation status',
      example: 'PENDING_APPROVAL',
   })
   moderationStatus!: ModerationStatusType;

   @ApiPropertyOptional({
      description: 'Rejection reason if moderation rejected this product',
      example: 'Cần cung cấp thêm giấy chứng nhận an toàn thực phẩm.',
   })
   rejectionReason?: string;

   @ApiProperty({
      description: 'Product packaging variants and stock levels',
      type: [ProductVariantDto],
   })
   variants!: ProductVariantDto[];

   @ApiProperty({
      description: 'Entity version for optimistic locking',
      example: 1,
   })
   version!: number;

   @ApiProperty({
      description: 'Creation timestamp',
      example: '2026-10-26T08:00:00.000Z',
   })
   createdAt!: string;

   @ApiProperty({
      description: 'Last update timestamp',
      example: '2026-10-26T08:00:00.000Z',
   })
   updatedAt!: string;
}
