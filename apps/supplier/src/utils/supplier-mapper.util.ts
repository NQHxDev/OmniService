import type { SupplierItemDto, SupplierStatusType } from '@contracts/supplier';
import type { SupplierEntity } from '@supplier/entities';

export function mapSupplierEntityToDto(entity: SupplierEntity): SupplierItemDto {
   return {
      supplierId: entity.supplierId,
      supplierName: entity.supplierName,
      supplierSlug: entity.supplierSlug,
      supplierCode: entity.supplierCode,
      contactEmail: entity.contactEmail || undefined,
      contactPhone: entity.contactPhone || undefined,
      address: entity.address || undefined,
      city: entity.city || undefined,
      rating: entity.rating,
      isVerified: entity.isVerified,
      supplierStatus: entity.supplierStatus as SupplierStatusType,
      supplierLogoUrl: entity.supplierLogoUrl || undefined,
      merchantType: entity.merchantType || undefined,
      citizenId: entity.citizenId || undefined,
      citizenIdIssuedDate: entity.citizenIdIssuedDate ? entity.citizenIdIssuedDate.toISOString() : undefined,
      idCardFrontUrl: entity.idCardFrontUrl || undefined,
      idCardBackUrl: entity.idCardBackUrl || undefined,
      businessName: entity.businessName || undefined,
      taxCode: entity.taxCode || undefined,
      businessLicenseUrl: entity.businessLicenseUrl || undefined,
      bankName: entity.bankName || undefined,
      bankAccountNumber: entity.bankAccountNumber || undefined,
      bankAccountHolder: entity.bankAccountHolder || undefined,
      rejectionReason: entity.rejectionReason || undefined,
      verifiedAt: entity.verifiedAt ? entity.verifiedAt.toISOString() : undefined,
   };
}
