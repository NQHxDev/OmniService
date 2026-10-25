import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
   ArrayMinSize,
   IsArray,
   IsEnum,
   IsInt,
   IsNotEmpty,
   IsNumber,
   IsOptional,
   IsPositive,
   IsString,
   MaxLength,
   ValidateNested,
} from 'class-validator';
import { PAYMENT_METHODS, type PaymentMethod } from '@contracts/order/constants/order-status.constant';

export class CreateOrderItemDto {
   @ApiProperty({
      description: 'UUID of the product offer being ordered',
      example: 'a0000000-0000-0000-0000-000000000001',
   })
   @IsNotEmpty()
   @IsString()
   productId!: string;

   @ApiProperty({
      description: 'Name/title of the product offer',
      example: 'Fresh Organic Tomatoes (1kg)',
   })
   @IsNotEmpty()
   @IsString()
   @MaxLength(200)
   productName!: string;

   @ApiProperty({
      description: 'Quantity of items to purchase',
      example: 2,
      minimum: 1,
   })
   @IsInt()
   @IsPositive()
   quantity!: number;

   @ApiProperty({
      description: 'Unit price per product item in standard currency',
      example: 45000,
   })
   @IsNumber()
   @IsPositive()
   unitPrice!: number;
}

export class CreateOrderDto {
   @ApiProperty({
      description: 'Selected payment method for this order',
      enum: PAYMENT_METHODS,
      example: PAYMENT_METHODS.COD,
   })
   @IsNotEmpty()
   @IsEnum(PAYMENT_METHODS)
   paymentMethod!: PaymentMethod;

   @ApiProperty({
      description: 'Detailed shipping delivery address',
      example: '123 Nguyen Hue Boulevard, District 1, Ho Chi Minh City',
   })
   @IsNotEmpty()
   @IsString()
   @MaxLength(500)
   shippingAddress!: string;

   @ApiProperty({
      description: 'Full name of the package recipient',
      example: 'Alex Nguyen',
   })
   @IsNotEmpty()
   @IsString()
   @MaxLength(100)
   receiverName!: string;

   @ApiProperty({
      description: 'Contact phone number of the package recipient',
      example: '+84901234567',
   })
   @IsNotEmpty()
   @IsString()
   @MaxLength(20)
   receiverPhone!: string;

   @ApiPropertyOptional({
      description: 'Optional note or delivery instructions for the order',
      example: 'Please call before delivery',
   })
   @IsOptional()
   @IsString()
   @MaxLength(500)
   note?: string;

   @ApiPropertyOptional({
      description: 'Estimated shipping delivery fee',
      example: 25000,
      default: 0,
   })
   @IsOptional()
   @IsNumber()
   shippingFee?: number;

   @ApiProperty({
      description: 'List of product items in this order',
      type: [CreateOrderItemDto],
   })
   @IsArray()
   @ArrayMinSize(1)
   @ValidateNested({ each: true })
   @Type(() => CreateOrderItemDto)
   items!: CreateOrderItemDto[];
}
