import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsInt, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';
import { WHO_CATEGORY_CODES, type WhoCategoryCode } from '@contracts/product/constants/product-categories.constant';

export class UpdateProductDto {
   @ApiPropertyOptional({
      description: 'Standard WHO food classification category code (1 of 8 groups)',
      enum: WHO_CATEGORY_CODES,
      example: WHO_CATEGORY_CODES.STAPLES,
   })
   @IsOptional()
   @IsEnum(WHO_CATEGORY_CODES)
   whoCategoryCode?: WhoCategoryCode;

   @ApiPropertyOptional({
      description: 'Updated product name',
      example: 'Gạo ST25 Thượng Hạng Sóc Trăng',
      maxLength: 200,
   })
   @IsOptional()
   @IsString()
   @MaxLength(200)
   productName?: string;

   @ApiPropertyOptional({
      description: 'Updated product description',
      example: 'Cập nhật thêm chi tiết về chứng nhận hữu cơ và phương thức thu hoạch.',
   })
   @IsOptional()
   @IsString()
   @MaxLength(2000)
   description?: string;

   @ApiPropertyOptional({
      description: 'Geographical origin',
      example: 'Huyện Mỹ Xuyên, Sóc Trăng',
      maxLength: 100,
   })
   @IsOptional()
   @IsString()
   @MaxLength(100)
   origin?: string;

   @ApiPropertyOptional({
      description: 'Storage instructions',
      example: 'Nơi khô ráo, đóng kín túi sau khi mở',
      maxLength: 200,
   })
   @IsOptional()
   @IsString()
   @MaxLength(200)
   storageCondition?: string;

   @ApiPropertyOptional({
      description: 'Shelf life in days',
      example: 240,
   })
   @IsOptional()
   @IsInt()
   @IsPositive()
   @Type(() => Number)
   shelfLifeDays?: number;

   @ApiPropertyOptional({
      description: 'Product image URLs',
      type: [String],
   })
   @IsOptional()
   @IsArray()
   @IsString({ each: true })
   images?: string[];
}
