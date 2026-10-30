import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SUPPLIER_STATUS, type SupplierStatusType } from '@contracts/supplier/constants/status.constant';

export class SupplierItemDto {
   @ApiProperty({
      description: 'Supplier unique UUID',
      example: '0192e21b-0003-7000-8000-000000000001',
   })
   supplierId!: string;

   @ApiProperty({
      description: 'Official supplier or brand name',
      example: 'Mega Market An Phú',
   })
   supplierName!: string;

   @ApiProperty({
      description: 'Unique URL slug for the supplier store page',
      example: 'mega-market-an-phu',
   })
   supplierSlug!: string;

   @ApiProperty({
      description: 'Merchant unique identification code',
      example: 'SUPP-MM-AP',
   })
   supplierCode!: string;

   @ApiPropertyOptional({
      description: 'Customer support or vendor contact email',
      example: 'contact@megamarket.vn',
   })
   contactEmail?: string;

   @ApiPropertyOptional({
      description: 'Hotline or customer support phone number',
      example: '19001234',
   })
   contactPhone?: string;

   @ApiPropertyOptional({
      description: 'Physical address of the supplier outlet or warehouse',
      example: 'Khu B, KĐT mới An Phú - An Khánh, TP. Thủ Đức, TP. Hồ Chí Minh',
   })
   address?: string;

   @ApiPropertyOptional({
      description: 'City or province where supplier operates',
      example: 'Hồ Chí Minh',
   })
   city?: string;

   @ApiProperty({
      description: 'Average customer rating score (1.0 to 5.0)',
      example: 4.8,
   })
   rating!: number;

   @ApiProperty({
      description: 'Whether the vendor has been officially verified by the platform',
      example: true,
   })
   isVerified!: boolean;

   @ApiProperty({
      description: 'Supplier status (ACTIVE, PENDING, UNDER_REVIEW, REJECTED, SUSPENDED)',
      enum: SUPPLIER_STATUS,
      example: SUPPLIER_STATUS.ACTIVE,
   })
   supplierStatus!: SupplierStatusType;

   @ApiPropertyOptional({
      description: 'Logo or brand avatar URL',
      example: 'https://cdn.omniservices.com/suppliers/mega-market.png',
   })
   supplierLogoUrl?: string;

   @ApiPropertyOptional({
      description: 'Business entity structure of merchant (INDIVIDUAL or ENTERPRISE)',
      example: 'ENTERPRISE',
   })
   merchantType?: string;

   @ApiPropertyOptional({
      description: 'National identity / passport number of merchant owner',
      example: '079090001234',
   })
   citizenId?: string;

   @ApiPropertyOptional({
      description: 'Date of identity document issuance',
      example: '2021-05-15T00:00:00.000Z',
   })
   citizenIdIssuedDate?: string;

   @ApiPropertyOptional({
      description: 'Public URL to ID card front image',
      example: 'https://cdn.omniservices.com/kyb/id-front.jpg',
   })
   idCardFrontUrl?: string;

   @ApiPropertyOptional({
      description: 'Public URL to ID card back image',
      example: 'https://cdn.omniservices.com/kyb/id-back.jpg',
   })
   idCardBackUrl?: string;

   @ApiPropertyOptional({
      description: 'Registered enterprise business name',
      example: 'Công Ty Cổ Phần Thương Mại Thực Phẩm Mega',
   })
   businessName?: string;

   @ApiPropertyOptional({
      description: 'Enterprise tax code',
      example: '0312345678',
   })
   taxCode?: string;

   @ApiPropertyOptional({
      description: 'Public URL to scanned business registration certificate',
      example: 'https://cdn.omniservices.com/kyb/business-license.pdf',
   })
   businessLicenseUrl?: string;

   @ApiPropertyOptional({
      description: 'Settlement bank name',
      example: 'Vietcombank',
   })
   bankName?: string;

   @ApiPropertyOptional({
      description: 'Settlement bank account number',
      example: '0071001234567',
   })
   bankAccountNumber?: string;

   @ApiPropertyOptional({
      description: 'Settlement bank account holder name',
      example: 'NGUYEN VAN A',
   })
   bankAccountHolder?: string;

   @ApiPropertyOptional({
      description: 'Admin rejection reason if KYB was reviewed and rejected',
      example: 'Invalid business license document provided.',
   })
   rejectionReason?: string;

   @ApiPropertyOptional({
      description: 'Timestamp when supplier was verified by platform compliance',
      example: '2026-10-27T10:00:00.000Z',
   })
   verifiedAt?: string;
}
