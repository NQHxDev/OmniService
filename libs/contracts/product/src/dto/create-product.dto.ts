import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
   ArrayMinSize,
   IsArray,
   IsEnum,
   IsInt,
   IsNotEmpty,
   IsOptional,
   IsPositive,
   IsString,
   MaxLength,
   ValidateNested,
} from 'class-validator';
import { WHO_CATEGORY_CODES, type WhoCategoryCode } from '../constants/product-categories.constant';
import { CreateProductVariantDto } from './product-variant.dto';

export class CreateProductDto {
   @ApiProperty({
      description: 'Standard WHO food classification category code (1 of 8 groups)',
      enum: WHO_CATEGORY_CODES,
      example: WHO_CATEGORY_CODES.STAPLES,
   })
   @IsNotEmpty()
   @IsEnum(WHO_CATEGORY_CODES)
   whoCategoryCode!: WhoCategoryCode;

   @ApiProperty({
      description: 'Standard culinary ingredient product name',
      example: 'Gạo ST25 Sóc Trăng Đạt Chuẩn GACP',
      maxLength: 200,
   })
   @IsNotEmpty()
   @IsString()
   @MaxLength(200)
   productName!: string;

   @ApiProperty({
      description: 'Detailed description of the product origin, quality and usage',
      example:
         'Gạo ST25 hảo hạng trồng tại vùng luân canh lúa - tôm Sóc Trăng, hạt dài trắng trong, dẻo thơm tự nhiên.',
   })
   @IsNotEmpty()
   @IsString()
   description!: string;

   @ApiPropertyOptional({
      description: 'Geographical origin or region of production',
      example: 'Sóc Trăng, Việt Nam',
      maxLength: 100,
   })
   @IsOptional()
   @IsString()
   @MaxLength(100)
   origin?: string;

   @ApiPropertyOptional({
      description: 'Recommended storage instructions',
      example: 'Bảo quản nơi khô ráo thoáng mát, tránh ánh nắng trực tiếp',
      maxLength: 200,
   })
   @IsOptional()
   @IsString()
   @MaxLength(200)
   storageCondition?: string;

   @ApiPropertyOptional({
      description: 'Shelf life period in days',
      example: 180,
   })
   @IsOptional()
   @IsInt()
   @IsPositive()
   @Type(() => Number)
   shelfLifeDays?: number;

   @ApiPropertyOptional({
      description: 'Product showcase image URLs',
      type: [String],
      example: ['https://cdn.omniservices.com/products/gao-st25-front.jpg'],
   })
   @IsOptional()
   @IsArray()
   @IsString({ each: true })
   images?: string[];

   @ApiProperty({
      description: 'List of product packaging variants (at least 1 required)',
      type: [CreateProductVariantDto],
   })
   @IsArray()
   @ArrayMinSize(1)
   @ValidateNested({ each: true })
   @Type(() => CreateProductVariantDto)
   variants!: CreateProductVariantDto[];
}
