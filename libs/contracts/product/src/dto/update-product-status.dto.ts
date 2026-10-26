import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { PRODUCT_STATUS, type ProductStatusType } from '../constants/status.constant';

export class UpdateProductStatusDto {
   @ApiProperty({
      description: 'Operational status for this approved product',
      enum: [PRODUCT_STATUS.ACTIVE, PRODUCT_STATUS.INACTIVE],
      example: PRODUCT_STATUS.ACTIVE,
   })
   @IsNotEmpty()
   @IsEnum([PRODUCT_STATUS.ACTIVE, PRODUCT_STATUS.INACTIVE])
   status!: ProductStatusType;
}
