import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { WHO_CATEGORY_CODES, type WhoCategoryCode } from '../constants/product-categories.constant';
import { PRODUCT_STATUS, type ProductStatusType } from '../constants/status.constant';

export class SearchProductsQueryDto {
   @ApiPropertyOptional({
      description: 'Search keyword for product name, ingredients, or description',
      example: 'Gạo ST25',
   })
   @IsOptional()
   @IsString()
   query?: string;

   @ApiPropertyOptional({
      description: 'Filter by standard WHO nutrition group code',
      enum: WHO_CATEGORY_CODES,
      example: WHO_CATEGORY_CODES.STAPLES,
   })
   @IsOptional()
   @IsEnum(WHO_CATEGORY_CODES)
   whoCategoryCode?: WhoCategoryCode;

   @ApiPropertyOptional({
      description: 'Filter by supplier ID',
      example: 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44',
   })
   @IsOptional()
   @IsString()
   supplierId?: string;

   @ApiPropertyOptional({
      description: 'Filter by operational status',
      enum: PRODUCT_STATUS,
      example: PRODUCT_STATUS.ACTIVE,
   })
   @IsOptional()
   @IsEnum(PRODUCT_STATUS)
   status?: ProductStatusType;

   @ApiPropertyOptional({
      description: 'Number of results to return (pagination limit)',
      default: 20,
      minimum: 1,
      maximum: 100,
   })
   @IsOptional()
   @Type(() => Number)
   @IsInt()
   @Min(1)
   @Max(100)
   limit?: number = 20;

   @ApiPropertyOptional({
      description: 'Offset for pagination',
      default: 0,
      minimum: 0,
   })
   @IsOptional()
   @Type(() => Number)
   @IsInt()
   @Min(0)
   offset?: number = 0;
}
