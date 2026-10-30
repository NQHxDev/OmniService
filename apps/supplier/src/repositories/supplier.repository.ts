import { Injectable } from '@nestjs/common';
import { SUPPLIER_STATUS, type SupplierStatusType } from '@contracts/supplier';
import { PrismaService } from '@supplier/prisma/prisma.service';
import type { Prisma, SupplierStatus as PrismaSupplierStatus } from '@supplier/prisma-client';
import type { CreateSupplierData, SupplierEntity, UpdateSupplierData } from '@supplier/entities';
import type { FindSuppliersParams, ISupplierRepository } from '@supplier/repositories/supplier.repository.interface';

@Injectable()
export class SupplierRepository implements ISupplierRepository {
   constructor(private readonly prisma: PrismaService) {}

   private mapPrismaToEntity(record: {
      supplierId: string;
      supplierName: string;
      supplierSlug: string;
      supplierCode: string;
      contactEmail: string | null;
      contactPhone: string | null;
      address: string | null;
      city: string | null;
      rating: number;
      isVerified: boolean;
      supplierStatus: string;
      supplierLogoUrl: string | null;
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
      version: number;
      deletedAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
   }): SupplierEntity {
      return {
         supplierId: record.supplierId,
         supplierName: record.supplierName,
         supplierSlug: record.supplierSlug,
         supplierCode: record.supplierCode,
         contactEmail: record.contactEmail,
         contactPhone: record.contactPhone,
         address: record.address,
         city: record.city,
         rating: record.rating,
         isVerified: record.isVerified,
         supplierStatus: record.supplierStatus,
         supplierLogoUrl: record.supplierLogoUrl,
         merchantType: record.merchantType,
         citizenId: record.citizenId,
         citizenIdIssuedDate: record.citizenIdIssuedDate,
         idCardFrontUrl: record.idCardFrontUrl,
         idCardBackUrl: record.idCardBackUrl,
         businessName: record.businessName,
         taxCode: record.taxCode,
         businessLicenseUrl: record.businessLicenseUrl,
         bankName: record.bankName,
         bankAccountNumber: record.bankAccountNumber,
         bankAccountHolder: record.bankAccountHolder,
         rejectionReason: record.rejectionReason,
         verifiedAt: record.verifiedAt,
         version: record.version,
         deletedAt: record.deletedAt,
         createdAt: record.createdAt,
         updatedAt: record.updatedAt,
      };
   }

   async findById(supplierId: string): Promise<SupplierEntity | null> {
      const record = await this.prisma.supplier.findFirst({
         where: { supplierId, deletedAt: null },
      });
      return record ? this.mapPrismaToEntity(record) : null;
   }

   async findByIds(supplierIds: string[]): Promise<SupplierEntity[]> {
      if (!supplierIds.length) {
         return [];
      }
      const records = await this.prisma.supplier.findMany({
         where: {
            supplierId: { in: supplierIds },
            deletedAt: null,
         },
      });
      return records.map((r) => this.mapPrismaToEntity(r));
   }

   async findBySlug(slug: string): Promise<SupplierEntity | null> {
      const record = await this.prisma.supplier.findFirst({
         where: { supplierSlug: slug, deletedAt: null },
      });
      return record ? this.mapPrismaToEntity(record) : null;
   }

   async findByCode(code: string): Promise<SupplierEntity | null> {
      const record = await this.prisma.supplier.findFirst({
         where: { supplierCode: code, deletedAt: null },
      });
      return record ? this.mapPrismaToEntity(record) : null;
   }

   async findMany(params: FindSuppliersParams): Promise<{ items: SupplierEntity[]; total: number }> {
      const where: Prisma.SupplierWhereInput = {
         deletedAt: null,
      };

      if (params.status) {
         where.supplierStatus = params.status as PrismaSupplierStatus;
      }

      if (params.city) {
         where.city = { contains: params.city, mode: 'insensitive' };
      }

      const limit = params.limit ?? 20;
      const offset = params.offset ?? 0;

      const [records, total] = await Promise.all([
         this.prisma.supplier.findMany({
            where,
            orderBy: [{ rating: 'desc' }, { createdAt: 'desc' }],
            take: limit,
            skip: offset,
         }),
         this.prisma.supplier.count({ where }),
      ]);

      return {
         items: records.map((r) => this.mapPrismaToEntity(r)),
         total,
      };
   }

   async create(data: CreateSupplierData): Promise<SupplierEntity> {
      const status: SupplierStatusType = (data.supplierStatus as SupplierStatusType) ?? SUPPLIER_STATUS.PENDING;

      const record = await this.prisma.supplier.create({
         data: {
            supplierName: data.supplierName,
            supplierSlug: data.supplierSlug,
            supplierCode: data.supplierCode,
            contactEmail: data.contactEmail,
            contactPhone: data.contactPhone,
            address: data.address,
            city: data.city,
            rating: data.rating ?? 5.0,
            isVerified: data.isVerified ?? false,
            supplierStatus: status,
            supplierLogoUrl: data.supplierLogoUrl,
            merchantType: data.merchantType,
            citizenId: data.citizenId,
            citizenIdIssuedDate: data.citizenIdIssuedDate,
            idCardFrontUrl: data.idCardFrontUrl,
            idCardBackUrl: data.idCardBackUrl,
            businessName: data.businessName,
            taxCode: data.taxCode,
            businessLicenseUrl: data.businessLicenseUrl,
            bankName: data.bankName,
            bankAccountNumber: data.bankAccountNumber,
            bankAccountHolder: data.bankAccountHolder,
            rejectionReason: data.rejectionReason,
            verifiedAt: data.verifiedAt,
         },
      });
      return this.mapPrismaToEntity(record);
   }

   async update(supplierId: string, data: UpdateSupplierData): Promise<SupplierEntity | null> {
      const record = await this.prisma.supplier.update({
         where: { supplierId },
         data: {
            ...(data.supplierName ? { supplierName: data.supplierName } : {}),
            ...(data.supplierSlug ? { supplierSlug: data.supplierSlug } : {}),
            ...(data.contactEmail !== undefined ? { contactEmail: data.contactEmail } : {}),
            ...(data.contactPhone !== undefined ? { contactPhone: data.contactPhone } : {}),
            ...(data.address !== undefined ? { address: data.address } : {}),
            ...(data.city !== undefined ? { city: data.city } : {}),
            ...(data.rating !== undefined ? { rating: data.rating } : {}),
            ...(data.isVerified !== undefined ? { isVerified: data.isVerified } : {}),
            ...(data.supplierStatus ? { supplierStatus: data.supplierStatus as PrismaSupplierStatus } : {}),
            ...(data.supplierLogoUrl !== undefined ? { supplierLogoUrl: data.supplierLogoUrl } : {}),
            ...(data.merchantType !== undefined ? { merchantType: data.merchantType } : {}),
            ...(data.citizenId !== undefined ? { citizenId: data.citizenId } : {}),
            ...(data.citizenIdIssuedDate !== undefined ? { citizenIdIssuedDate: data.citizenIdIssuedDate } : {}),
            ...(data.idCardFrontUrl !== undefined ? { idCardFrontUrl: data.idCardFrontUrl } : {}),
            ...(data.idCardBackUrl !== undefined ? { idCardBackUrl: data.idCardBackUrl } : {}),
            ...(data.businessName !== undefined ? { businessName: data.businessName } : {}),
            ...(data.taxCode !== undefined ? { taxCode: data.taxCode } : {}),
            ...(data.businessLicenseUrl !== undefined ? { businessLicenseUrl: data.businessLicenseUrl } : {}),
            ...(data.bankName !== undefined ? { bankName: data.bankName } : {}),
            ...(data.bankAccountNumber !== undefined ? { bankAccountNumber: data.bankAccountNumber } : {}),
            ...(data.bankAccountHolder !== undefined ? { bankAccountHolder: data.bankAccountHolder } : {}),
            ...(data.rejectionReason !== undefined ? { rejectionReason: data.rejectionReason } : {}),
            ...(data.verifiedAt !== undefined ? { verifiedAt: data.verifiedAt } : {}),
            version: { increment: 1 },
         },
      });
      return this.mapPrismaToEntity(record);
   }

   async softDelete(supplierId: string): Promise<boolean> {
      const res = await this.prisma.supplier.update({
         where: { supplierId },
         data: {
            deletedAt: new Date(),
            version: { increment: 1 },
         },
      });
      return !!res;
   }
}
