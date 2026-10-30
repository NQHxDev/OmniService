import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Public-safe summary of the store selling a product (no KYB, banking or contact data).
 */
export class ProductSupplierSummaryDto {
   @ApiProperty({
      description: 'Supplier unique UUID',
      example: '0192e21b-0003-7000-8000-000000000001',
   })
   supplierId!: string;

   @ApiProperty({
      description: 'Official store or brand name',
      example: 'Mega Market An Phú',
   })
   supplierName!: string;

   @ApiProperty({
      description: 'URL slug of the store page',
      example: 'mega-market-an-phu',
   })
   supplierSlug!: string;

   @ApiPropertyOptional({
      description: 'Store logo or brand avatar URL',
      example: 'https://cdn.omniservices.com/suppliers/mega-market.png',
   })
   supplierLogoUrl?: string;

   @ApiPropertyOptional({
      description: 'Store address',
      example: 'Khu B, KĐT mới An Phú - An Khánh, TP. Thủ Đức, TP. Hồ Chí Minh',
   })
   address?: string;

   @ApiPropertyOptional({
      description: 'City or province where the store operates',
      example: 'Hồ Chí Minh',
   })
   city?: string;

   @ApiProperty({
      description: 'Average customer rating score (1.0 to 5.0)',
      example: 4.8,
   })
   rating!: number;

   @ApiProperty({
      description: 'Whether the store has been verified by the platform',
      example: true,
   })
   isVerified!: boolean;
}
