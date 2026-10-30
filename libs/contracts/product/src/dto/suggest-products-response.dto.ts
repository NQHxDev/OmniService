import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WHO_CATEGORY_CODES, type WhoCategoryCode } from '@contracts/product/constants/product-categories.constant';
import { CURRENCY, type CurrencyType } from '@contracts/product/constants/status.constant';

export class ProductSuggestionItemDto {
   @ApiProperty({
      description: 'Unique product identifier UUID',
      example: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
   })
   productId!: string;

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
      description: 'Standard WHO nutrition group code',
      enum: WHO_CATEGORY_CODES,
      example: WHO_CATEGORY_CODES.STAPLES,
   })
   whoCategoryCode!: WhoCategoryCode;

   @ApiPropertyOptional({
      description: 'Origin region',
      example: 'Sóc Trăng',
   })
   origin?: string;

   @ApiProperty({
      description: 'Product media images gallery URLs',
      type: [String],
      example: ['https://storage.omni.io/products/gao-st25.jpg'],
   })
   images!: string[];

   @ApiPropertyOptional({
      description: 'Default package unit (kg, gam, hop, chai...)',
      example: 'kg',
   })
   defaultUnit?: string;

   @ApiPropertyOptional({
      description: 'Minimum price among packaging variants',
      example: 180000,
   })
   minPrice?: number;

   @ApiPropertyOptional({
      description: 'Maximum price among packaging variants',
      example: 250000,
   })
   maxPrice?: number;

   @ApiPropertyOptional({
      description: 'Pricing currency',
      enum: CURRENCY,
      example: CURRENCY.VND,
   })
   currency?: CurrencyType;
}

export class SuggestProductsResponseDto {
   @ApiProperty({
      description: 'Autocomplete / typeahead suggestion items',
      type: [ProductSuggestionItemDto],
   })
   items!: ProductSuggestionItemDto[];
}
