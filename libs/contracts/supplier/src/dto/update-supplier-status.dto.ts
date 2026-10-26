import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { SUPPLIER_STATUS, type SupplierStatusType } from '@contracts/supplier/constants/status.constant';

export class UpdateSupplierStatusDto {
   @ApiProperty({
      description: 'Operational status to apply to the supplier store (ACTIVE, PENDING, SUSPENDED)',
      enum: SUPPLIER_STATUS,
      example: SUPPLIER_STATUS.ACTIVE,
   })
   @IsEnum(SUPPLIER_STATUS)
   status!: SupplierStatusType;
}
