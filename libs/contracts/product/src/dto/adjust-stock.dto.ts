import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { STOCK_MOVEMENT_TYPE, type StockMovementType } from '../constants/status.constant';

export class AdjustStockDto {
   @ApiProperty({
      description: 'Signed inventory quantity adjustment (positive for inbound/increase, negative for reduction)',
      example: 50,
   })
   @IsInt()
   @Type(() => Number)
   quantityDelta!: number;

   @ApiProperty({
      description: 'Classification of inventory movement',
      enum: STOCK_MOVEMENT_TYPE,
      example: STOCK_MOVEMENT_TYPE.INBOUND,
   })
   @IsNotEmpty()
   @IsEnum(STOCK_MOVEMENT_TYPE)
   movementType!: StockMovementType;

   @ApiPropertyOptional({
      description: 'Business reason or warehouse reference note',
      example: 'Nhập lô hàng vụ mùa mới từ nhà máy Sóc Trăng',
      maxLength: 255,
   })
   @IsOptional()
   @IsString()
   @MaxLength(255)
   reason?: string;
}
