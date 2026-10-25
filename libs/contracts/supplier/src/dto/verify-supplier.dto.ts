import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class VerifySupplierDto {
   @ApiProperty({
      description: 'Verification status to apply to the supplier',
      example: true,
      default: true,
   })
   @IsBoolean()
   isVerified!: boolean;
}
