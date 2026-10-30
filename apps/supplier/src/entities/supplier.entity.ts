export interface SupplierEntity {
   supplierId: string;
   supplierName: string;
   supplierSlug: string;
   supplierCode: string;
   contactEmail?: string | null;
   contactPhone?: string | null;
   address?: string | null;
   city?: string | null;
   rating: number;
   isVerified: boolean;
   supplierStatus: string;
   supplierLogoUrl?: string | null;
   merchantType?: string | null;
   citizenId?: string | null;
   citizenIdIssuedDate?: Date | null;
   idCardFrontUrl?: string | null;
   idCardBackUrl?: string | null;
   businessName?: string | null;
   taxCode?: string | null;
   businessLicenseUrl?: string | null;
   bankName?: string | null;
   bankAccountNumber?: string | null;
   bankAccountHolder?: string | null;
   rejectionReason?: string | null;
   verifiedAt?: Date | null;
   version?: number;
   deletedAt?: Date | null;
   createdAt: Date;
   updatedAt: Date;
}

export interface CreateSupplierData {
   supplierName: string;
   supplierSlug: string;
   supplierCode: string;
   contactEmail?: string | null;
   contactPhone?: string | null;
   address?: string | null;
   city?: string | null;
   rating?: number;
   isVerified?: boolean;
   supplierStatus?: string;
   supplierLogoUrl?: string | null;
   merchantType?: string | null;
   citizenId?: string | null;
   citizenIdIssuedDate?: Date | null;
   idCardFrontUrl?: string | null;
   idCardBackUrl?: string | null;
   businessName?: string | null;
   taxCode?: string | null;
   businessLicenseUrl?: string | null;
   bankName?: string | null;
   bankAccountNumber?: string | null;
   bankAccountHolder?: string | null;
   rejectionReason?: string | null;
   verifiedAt?: Date | null;
}

export interface UpdateSupplierData {
   supplierName?: string;
   supplierSlug?: string;
   contactEmail?: string | null;
   contactPhone?: string | null;
   address?: string | null;
   city?: string | null;
   rating?: number;
   isVerified?: boolean;
   supplierStatus?: string;
   supplierLogoUrl?: string | null;
   merchantType?: string | null;
   citizenId?: string | null;
   citizenIdIssuedDate?: Date | null;
   idCardFrontUrl?: string | null;
   idCardBackUrl?: string | null;
   businessName?: string | null;
   taxCode?: string | null;
   businessLicenseUrl?: string | null;
   bankName?: string | null;
   bankAccountNumber?: string | null;
   bankAccountHolder?: string | null;
   rejectionReason?: string | null;
   verifiedAt?: Date | null;
}
