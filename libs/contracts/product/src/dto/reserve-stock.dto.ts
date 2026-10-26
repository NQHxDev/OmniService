import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsNotEmpty, IsPositive, IsUUID, ValidateNested } from 'class-validator';

export class StockItemDto {
   @ApiProperty({
      description: 'Target variant ID',
      example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
   })
   @IsNotEmpty()
   @IsUUID()
   variantId!: string;

   @ApiProperty({
      description: 'Quantity to reserve/release',
      example: 2,
   })
   @IsInt()
   @IsPositive()
   @Type(() => Number)
   quantity!: number;
}

export class CheckAndReserveStockDto {
   @ApiProperty({
      description: 'Order reference ID',
      example: 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
   })
   @IsNotEmpty()
   @IsUUID()
   orderId!: string;

   @ApiProperty({
      description: 'List of order items needing reservation',
      type: [StockItemDto],
   })
   @IsArray()
   @ArrayMinSize(1)
   @ValidateNested({ each: true })
   @Type(() => StockItemDto)
   items!: StockItemDto[];
}

export class ReservedItemResultDto {
   @ApiProperty({ example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' })
   variantId!: string;

   @ApiProperty({ example: 'RICE-ST25-5KG' })
   sku!: string;

   @ApiProperty({ example: true })
   success!: boolean;

   @ApiProperty({ example: 98 })
   availableStock!: number;

   @ApiProperty({ required: false, example: 'Stock reserved successfully' })
   message?: string;
}

export class CheckAndReserveStockResponseDto {
   @ApiProperty({ example: true })
   allReserved!: boolean;

   @ApiProperty({ type: [ReservedItemResultDto] })
   results!: ReservedItemResultDto[];
}

export class ReleaseStockDto {
   @ApiProperty({
      description: 'Order reference ID',
      example: 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
   })
   @IsNotEmpty()
   @IsUUID()
   orderId!: string;

   @ApiProperty({
      description: 'Items to release back into available stock',
      type: [StockItemDto],
   })
   @IsArray()
   @ArrayMinSize(1)
   @ValidateNested({ each: true })
   @Type(() => StockItemDto)
   items!: StockItemDto[];
}
