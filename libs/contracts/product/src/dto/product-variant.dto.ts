import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, MaxLength, Min } from 'class-validator';
import { CURRENCY, type CurrencyType, VARIANT_STATUS, type VariantStatusType } from '../constants/status.constant';

export class CreateProductVariantDto {
   @ApiProperty({
      description: 'Unique Stock Keeping Unit (SKU) code',
      example: 'RICE-ST25-5KG',
      maxLength: 100,
   })
   @IsNotEmpty()
   @IsString()
   @MaxLength(100)
   sku!: string;

   @ApiProperty({
      description: 'Variant name (e.g. package type, weight)',
      example: 'Túi 5kg hút chân không',
      maxLength: 150,
   })
   @IsNotEmpty()
   @IsString()
   @MaxLength(150)
   variantName!: string;

   @ApiProperty({
      description: 'Unit of measurement',
      example: 'túi',
      maxLength: 50,
   })
   @IsNotEmpty()
   @IsString()
   @MaxLength(50)
   unit!: string;

   @ApiPropertyOptional({
      description: 'Standardized pack size quantity or volume',
      example: '5kg',
   })
   @IsOptional()
   @IsString()
   packSize?: string;

   @ApiProperty({
      description: 'Selling price per unit',
      example: 180000,
   })
   @IsNumber()
   @IsPositive()
   @Type(() => Number)
   price!: number;

   @ApiPropertyOptional({
      description: 'Original or strike-through market price',
      example: 210000,
   })
   @IsOptional()
   @IsNumber()
   @IsPositive()
   @Type(() => Number)
   originalPrice?: number;

   @ApiPropertyOptional({
      description: 'Currency code (defaults to VND)',
      enum: CURRENCY,
      default: CURRENCY.VND,
   })
   @IsOptional()
   @IsString()
   currency?: CurrencyType;

   @ApiProperty({
      description: 'Initial inventory quantity available in stock',
      example: 100,
   })
   @IsNumber()
   @Min(0)
   @Type(() => Number)
   stockQuantity!: number;

   @ApiPropertyOptional({
      description: 'Low stock threshold alerting the supplier',
      example: 10,
      default: 10,
   })
   @IsOptional()
   @IsNumber()
   @Min(0)
   @Type(() => Number)
   lowStockThreshold?: number;

   @ApiPropertyOptional({
      description: 'Whether this variant is the default selection',
      default: false,
   })
   @IsOptional()
   @IsBoolean()
   isDefault?: boolean;
}

export class ProductVariantDto {
   @ApiProperty({
      description: 'Unique identifier of the product variant',
      example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
   })
   variantId!: string;

   @ApiProperty({
      description: 'Parent product ID',
      example: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
   })
   productId!: string;

   @ApiProperty({
      description: 'Stock Keeping Unit (SKU)',
      example: 'RICE-ST25-5KG',
   })
   sku!: string;

   @ApiProperty({
      description: 'Variant name',
      example: 'Túi 5kg hút chân không',
   })
   variantName!: string;

   @ApiProperty({
      description: 'Unit of measurement',
      example: 'túi',
   })
   unit!: string;

   @ApiPropertyOptional({
      description: 'Standardized pack size',
      example: '5kg',
   })
   packSize?: string;

   @ApiProperty({
      description: 'Selling price per unit',
      example: 180000,
   })
   price!: number;

   @ApiPropertyOptional({
      description: 'Original strike-through price',
      example: 210000,
   })
   originalPrice?: number;

   @ApiProperty({
      description: 'Currency code',
      example: 'VND',
   })
   currency!: CurrencyType;

   @ApiProperty({
      description: 'Available stock quantity',
      example: 100,
   })
   stockQuantity!: number;

   @ApiProperty({
      description: 'Currently reserved quantity during checkout',
      example: 2,
   })
   reservedQuantity!: number;

   @ApiProperty({
      description: 'Low stock warning threshold',
      example: 10,
   })
   lowStockThreshold!: number;

   @ApiProperty({
      description: 'Is this the default variant shown to buyers',
      example: true,
   })
   isDefault!: boolean;

   @ApiProperty({
      description: 'Operational status of this variant',
      enum: VARIANT_STATUS,
      example: VARIANT_STATUS.AVAILABLE,
   })
   status!: VariantStatusType;
}
