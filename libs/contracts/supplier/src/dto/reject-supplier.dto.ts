import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RejectSupplierDto {
   @ApiProperty({
      description: 'Official reason for rejecting the supplier verification/KYB submission',
      example: 'ID card front image is blurry and tax code does not match National Business Registry records.',
      maxLength: 500,
   })
   @IsNotEmpty()
   @IsString()
   @MaxLength(500)
   reason!: string;
}
