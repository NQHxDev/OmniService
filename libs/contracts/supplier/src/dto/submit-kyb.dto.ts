import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, IsUrl, MaxLength, ValidateIf } from 'class-validator';
import { MERCHANT_TYPE, MerchantTypeEnum, type MerchantType } from '@contracts/supplier/constants/status.constant';

export class SubmitKybDto {
   @ApiProperty({
      description: 'Type of merchant business entity',
      enum: MERCHANT_TYPE,
      example: MERCHANT_TYPE.INDIVIDUAL,
   })
   @IsNotEmpty()
   @IsEnum(MerchantTypeEnum)
   merchantType!: MerchantType;

   @ApiPropertyOptional({
      description: 'National citizen identity card or passport number (for INDIVIDUAL)',
      example: '079090001234',
      maxLength: 50,
   })
   @IsOptional()
   @IsString()
   @MaxLength(50)
   citizenId?: string;

   @ApiPropertyOptional({
      description: 'Date of issuance of the identity card (ISO 8601 string)',
      example: '2021-05-15T00:00:00.000Z',
   })
   @IsOptional()
   @IsDateString()
   citizenIdIssuedDate?: string;

   @ApiPropertyOptional({
      description: 'Public URL to the front image of the national ID card',
      example: 'https://cdn.omniservices.com/kyb/id-front.jpg',
   })
   @IsOptional()
   @ValidateIf((_, val) => typeof val === 'string' && val.trim().length > 0)
   @IsUrl({ require_tld: false })
   idCardFrontUrl?: string;

   @ApiPropertyOptional({
      description: 'Public URL to the back image of the national ID card',
      example: 'https://cdn.omniservices.com/kyb/id-back.jpg',
   })
   @IsOptional()
   @ValidateIf((_, val) => typeof val === 'string' && val.trim().length > 0)
   @IsUrl({ require_tld: false })
   idCardBackUrl?: string;

   @ApiPropertyOptional({
      description: 'Registered legal business name (for ENTERPRISE)',
      example: 'Công Ty Cổ Phần Thương Mại Thực Phẩm Mega',
      maxLength: 200,
   })
   @IsOptional()
   @IsString()
   @MaxLength(200)
   businessName?: string;

   @ApiPropertyOptional({
      description: 'Enterprise tax identification code (Mã số thuế)',
      example: '0312345678',
      maxLength: 50,
   })
   @IsOptional()
   @IsString()
   @MaxLength(50)
   taxCode?: string;

   @ApiPropertyOptional({
      description: 'Public URL to the scanned enterprise business license',
      example: 'https://cdn.omniservices.com/kyb/business-license.pdf',
   })
   @IsOptional()
   @ValidateIf((_, val) => typeof val === 'string' && val.trim().length > 0)
   @IsUrl({ require_tld: false })
   businessLicenseUrl?: string;

   @ApiPropertyOptional({
      description: 'Beneficiary bank name for revenue payout settlements',
      example: 'Vietcombank - Chi nhánh TP.HCM',
      maxLength: 100,
   })
   @IsOptional()
   @IsString()
   @MaxLength(100)
   bankName?: string;

   @ApiPropertyOptional({
      description: 'Bank account number for revenue settlements',
      example: '0071001234567',
      maxLength: 50,
   })
   @IsOptional()
   @IsString()
   @MaxLength(50)
   bankAccountNumber?: string;

   @ApiPropertyOptional({
      description: 'Bank account holder full name (all-caps English or Vietnamese)',
      example: 'NGUYEN VAN A',
      maxLength: 150,
   })
   @IsOptional()
   @IsString()
   @MaxLength(150)
   bankAccountHolder?: string;
}
