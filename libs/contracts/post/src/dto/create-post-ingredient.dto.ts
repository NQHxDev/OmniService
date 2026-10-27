import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class CreatePostIngredientDto {
   @ApiProperty({
      description: 'Name of the ingredient',
      example: 'Thịt bò phi lê',
   })
   @IsString()
   @IsNotEmpty()
   @MaxLength(100)
   name!: string;

   @ApiPropertyOptional({
      description: 'Quantity / amount of the ingredient',
      example: 250,
   })
   @IsNumber()
   @IsOptional()
   @Min(0)
   amount?: number;

   @ApiPropertyOptional({
      description: 'Measurement unit (g, ml, muỗng cà phê, etc.)',
      example: 'g',
   })
   @IsString()
   @IsOptional()
   @MaxLength(30)
   unit?: string;

   @ApiPropertyOptional({
      description: 'Ingredient grouping (Nguyên liệu chính, Gia vị ướp, Nước sốt)',
      example: 'Nguyên liệu chính',
   })
   @IsString()
   @IsOptional()
   @MaxLength(50)
   group?: string;

   @ApiPropertyOptional({
      description: 'Display order in ingredient list',
      example: 0,
      default: 0,
   })
   @IsNumber()
   @IsOptional()
   sortOrder?: number = 0;

   @ApiPropertyOptional({
      description: 'Catalog ingredient ID linked with commerce ecosystem to enable 1-click buy',
      example: '0192e21b-0002-7000-8000-000000000001',
   })
   @IsUUID('4')
   @IsOptional()
   catalogIngredientId?: string;
}
