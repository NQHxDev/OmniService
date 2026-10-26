import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { WHO_CATEGORY_CODES, type WhoCategoryCode } from '../constants/product-categories.constant';
import {
   MODERATION_STATUS,
   type ModerationStatusType,
   PRODUCT_STATUS,
   type ProductStatusType,
} from '../constants/status.constant';
import { ProductItemDto } from './product-item.dto';

export class ListProductsQueryDto {
   @ApiPropertyOptional({
      description: 'Filter by specific supplier ID',
      example: 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44',
   })
   @IsOptional()
   @IsString()
   supplierId?: string;

   @ApiPropertyOptional({
      description: 'Filter by WHO nutrition group',
      enum: WHO_CATEGORY_CODES,
   })
   @IsOptional()
   @IsEnum(WHO_CATEGORY_CODES)
   whoCategoryCode?: WhoCategoryCode;

   @ApiPropertyOptional({
      description: 'Filter by operational status',
      enum: PRODUCT_STATUS,
   })
   @IsOptional()
   @IsEnum(PRODUCT_STATUS)
   status?: ProductStatusType;

   @ApiPropertyOptional({
      description: 'Filter by moderation status',
      enum: MODERATION_STATUS,
   })
   @IsOptional()
   @IsEnum(MODERATION_STATUS)
   moderationStatus?: ModerationStatusType;

   @ApiPropertyOptional({
      description: 'Keyword search in product title and description',
      example: 'gạo',
   })
   @IsOptional()
   @IsString()
   search?: string;

   @ApiPropertyOptional({
      description: 'Number of results to return (pagination limit)',
      default: 20,
      minimum: 1,
      maximum: 100,
   })
   @IsOptional()
   @IsInt()
   @Min(1)
   @Max(100)
   @Type(() => Number)
   limit?: number = 20;

   @ApiPropertyOptional({
      description: 'Pagination offset',
      default: 0,
      minimum: 0,
   })
   @IsOptional()
   @IsInt()
   @Min(0)
   @Type(() => Number)
   offset?: number = 0;
}

export class ListProductsResponseDto {
   @ApiProperty({
      type: [ProductItemDto],
      description: 'List of matching products',
   })
   items!: ProductItemDto[];

   @ApiProperty({
      description: 'Total number of records matching filter criteria',
      example: 42,
   })
   total!: number;
}
