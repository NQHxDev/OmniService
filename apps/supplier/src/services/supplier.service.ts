import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BadRequestException, ConflictException, NotFoundException } from '@common';
import {
   SUPPLIER_ERROR_CODES,
   SUPPLIER_EVENTS,
   SUPPLIER_STATUS,
   type RegisterSupplierDto,
   type SubmitKybDto,
   type SupplierStatusType,
   type UpdateSupplierDto,
} from '@contracts/supplier';
import { SUPPLIER_REPOSITORY, type FindSuppliersParams, type ISupplierRepository } from '@supplier/repositories';
import { Slug, SupplierCode } from '@supplier/domain/value-objects';
import {
   SupplierKybSubmittedEvent,
   SupplierRegisteredEvent,
   SupplierRejectedEvent,
   SupplierStatusChangedEvent,
   SupplierUpdatedEvent,
   SupplierVerifiedEvent,
} from '@supplier/domain/events';
import type { SupplierEntity } from '@supplier/entities';

@Injectable()
export class SupplierService {
   constructor(
      @Inject(SUPPLIER_REPOSITORY)
      private readonly supplierRepository: ISupplierRepository,
      private readonly eventEmitter: EventEmitter2,
   ) {}

   async getSupplierById(supplierId: string): Promise<SupplierEntity> {
      const supplier = await this.supplierRepository.findById(supplierId);
      if (!supplier) {
         throw new NotFoundException(SUPPLIER_ERROR_CODES.SUPPLIER_NOT_FOUND, {
            params: { supplierId },
         });
      }
      return supplier;
   }

   async getSuppliersByIds(supplierIds: string[]): Promise<SupplierEntity[]> {
      if (!supplierIds.length) {
         return [];
      }
      return this.supplierRepository.findByIds(supplierIds);
   }

   async listSuppliers(params: FindSuppliersParams): Promise<{ items: SupplierEntity[]; total: number }> {
      return this.supplierRepository.findMany(params);
   }

   async registerSupplier(dto: RegisterSupplierDto): Promise<SupplierEntity> {
      let codeVo: SupplierCode;
      if (dto.supplierCode && dto.supplierCode.trim()) {
         codeVo = new SupplierCode(dto.supplierCode);
         const existingByCode = await this.supplierRepository.findByCode(codeVo.value);
         if (existingByCode) {
            throw new ConflictException(SUPPLIER_ERROR_CODES.SUPPLIER_CODE_ALREADY_EXISTS, {
               params: { code: codeVo.value },
            });
         }
      } else {
         let attempts = 0;
         while (true) {
            const candidate = SupplierCode.generate();
            const existing = await this.supplierRepository.findByCode(candidate.value);
            if (!existing) {
               codeVo = candidate;
               break;
            }
            attempts++;
            if (attempts > 5) {
               codeVo = SupplierCode.generateFallback();
               break;
            }
         }
      }

      const slugVo = new Slug(dto.supplierName);
      const supplierSlug = await this.generateUniqueSlug(slugVo.value);

      const created = await this.supplierRepository.create({
         supplierName: dto.supplierName.trim(),
         supplierSlug,
         supplierCode: codeVo.value,
         contactEmail: dto.contactEmail?.trim(),
         contactPhone: dto.contactPhone?.trim(),
         address: dto.address?.trim(),
         city: dto.city?.trim(),
         supplierLogoUrl: dto.supplierLogoUrl,
         isVerified: false,
         supplierStatus: SUPPLIER_STATUS.PENDING,
      });

      this.eventEmitter.emit(
         SUPPLIER_EVENTS.SUPPLIER_REGISTERED,
         new SupplierRegisteredEvent(created.supplierId, created.supplierName, created.supplierCode),
      );

      return created;
   }

   async updateSupplier(supplierId: string, dto: UpdateSupplierDto): Promise<SupplierEntity> {
      const existing = await this.supplierRepository.findById(supplierId);
      if (!existing) {
         throw new NotFoundException(SUPPLIER_ERROR_CODES.SUPPLIER_NOT_FOUND, {
            params: { supplierId },
         });
      }

      let newSlug: string | undefined;
      if (dto.supplierName && dto.supplierName.trim() !== existing.supplierName) {
         const baseSlug = new Slug(dto.supplierName).value;
         newSlug = await this.generateUniqueSlug(baseSlug, supplierId);
      }

      const updated = await this.supplierRepository.update(supplierId, {
         supplierName: dto.supplierName?.trim(),
         supplierSlug: newSlug,
         contactEmail: dto.contactEmail !== undefined ? dto.contactEmail?.trim() : undefined,
         contactPhone: dto.contactPhone !== undefined ? dto.contactPhone?.trim() : undefined,
         address: dto.address !== undefined ? dto.address?.trim() : undefined,
         city: dto.city !== undefined ? dto.city?.trim() : undefined,
         supplierLogoUrl: dto.supplierLogoUrl,
      });

      if (!updated) {
         throw new NotFoundException(SUPPLIER_ERROR_CODES.SUPPLIER_NOT_FOUND, {
            params: { supplierId },
         });
      }

      this.eventEmitter.emit(
         SUPPLIER_EVENTS.SUPPLIER_UPDATED,
         new SupplierUpdatedEvent(updated.supplierId, updated.supplierName),
      );

      return updated;
   }

   async updateSupplierStatus(supplierId: string, status: SupplierStatusType): Promise<SupplierEntity> {
      if (!status || !Object.values(SUPPLIER_STATUS).includes(status)) {
         throw new BadRequestException(SUPPLIER_ERROR_CODES.INVALID_STATUS, {
            params: { status },
         });
      }

      const existing = await this.supplierRepository.findById(supplierId);
      if (!existing) {
         throw new NotFoundException(SUPPLIER_ERROR_CODES.SUPPLIER_NOT_FOUND, {
            params: { supplierId },
         });
      }

      if (existing.supplierStatus === status) {
         return existing;
      }

      const updated = await this.supplierRepository.update(supplierId, { supplierStatus: status });
      if (!updated) {
         throw new NotFoundException(SUPPLIER_ERROR_CODES.SUPPLIER_NOT_FOUND, {
            params: { supplierId },
         });
      }

      this.eventEmitter.emit(
         SUPPLIER_EVENTS.SUPPLIER_STATUS_CHANGED,
         new SupplierStatusChangedEvent(supplierId, existing.supplierStatus, status),
      );

      return updated;
   }

   async submitKyb(supplierId: string, dto: SubmitKybDto): Promise<SupplierEntity> {
      const existing = await this.supplierRepository.findById(supplierId);
      if (!existing) {
         throw new NotFoundException(SUPPLIER_ERROR_CODES.SUPPLIER_NOT_FOUND, {
            params: { supplierId },
         });
      }

      if (existing.supplierStatus !== SUPPLIER_STATUS.PENDING && existing.supplierStatus !== SUPPLIER_STATUS.REJECTED) {
         if (existing.supplierStatus === SUPPLIER_STATUS.UNDER_REVIEW) {
            throw new BadRequestException(SUPPLIER_ERROR_CODES.KYB_ALREADY_SUBMITTED, {
               params: { status: existing.supplierStatus },
            });
         }
         throw new BadRequestException(SUPPLIER_ERROR_CODES.CANNOT_SUBMIT_KYB, {
            params: { status: existing.supplierStatus },
         });
      }

      const updated = await this.supplierRepository.update(supplierId, {
         supplierStatus: SUPPLIER_STATUS.UNDER_REVIEW,
         merchantType: dto.merchantType,
         citizenId: dto.citizenId?.trim() || undefined,
         citizenIdIssuedDate: dto.citizenIdIssuedDate ? new Date(dto.citizenIdIssuedDate) : undefined,
         idCardFrontUrl: dto.idCardFrontUrl?.trim() || undefined,
         idCardBackUrl: dto.idCardBackUrl?.trim() || undefined,
         businessName: dto.businessName?.trim() || undefined,
         taxCode: dto.taxCode?.trim() || undefined,
         businessLicenseUrl: dto.businessLicenseUrl?.trim() || undefined,
         bankName: dto.bankName?.trim() || undefined,
         bankAccountNumber: dto.bankAccountNumber?.trim() || undefined,
         bankAccountHolder: dto.bankAccountHolder?.trim() || undefined,
         rejectionReason: null,
      });

      if (!updated) {
         throw new NotFoundException(SUPPLIER_ERROR_CODES.SUPPLIER_NOT_FOUND, {
            params: { supplierId },
         });
      }

      this.eventEmitter.emit(
         SUPPLIER_EVENTS.SUPPLIER_KYB_SUBMITTED,
         new SupplierKybSubmittedEvent(supplierId, dto.merchantType),
      );

      return updated;
   }

   async verifySupplier(supplierId: string, isVerified: boolean): Promise<SupplierEntity> {
      const existing = await this.supplierRepository.findById(supplierId);
      if (!existing) {
         throw new NotFoundException(SUPPLIER_ERROR_CODES.SUPPLIER_NOT_FOUND, {
            params: { supplierId },
         });
      }

      const newStatus = isVerified ? SUPPLIER_STATUS.ACTIVE : SUPPLIER_STATUS.PENDING;
      const verifiedAt = isVerified ? new Date() : null;

      const updated = await this.supplierRepository.update(supplierId, {
         isVerified,
         supplierStatus: newStatus,
         verifiedAt,
         rejectionReason: null,
      });
      if (!updated) {
         throw new NotFoundException(SUPPLIER_ERROR_CODES.SUPPLIER_NOT_FOUND, {
            params: { supplierId },
         });
      }

      this.eventEmitter.emit(SUPPLIER_EVENTS.SUPPLIER_VERIFIED, new SupplierVerifiedEvent(supplierId, isVerified));

      return updated;
   }

   async rejectSupplier(supplierId: string, reason: string): Promise<SupplierEntity> {
      if (!reason || !reason.trim()) {
         throw new BadRequestException(SUPPLIER_ERROR_CODES.REJECTION_REASON_REQUIRED);
      }

      const existing = await this.supplierRepository.findById(supplierId);
      if (!existing) {
         throw new NotFoundException(SUPPLIER_ERROR_CODES.SUPPLIER_NOT_FOUND, {
            params: { supplierId },
         });
      }

      const updated = await this.supplierRepository.update(supplierId, {
         isVerified: false,
         supplierStatus: SUPPLIER_STATUS.REJECTED,
         rejectionReason: reason.trim(),
      });
      if (!updated) {
         throw new NotFoundException(SUPPLIER_ERROR_CODES.SUPPLIER_NOT_FOUND, {
            params: { supplierId },
         });
      }

      this.eventEmitter.emit(SUPPLIER_EVENTS.SUPPLIER_REJECTED, new SupplierRejectedEvent(supplierId, reason.trim()));

      return updated;
   }

   private async generateUniqueSlug(baseSlug: string, excludeSupplierId?: string): Promise<string> {
      const trimmedBase = baseSlug.length > 160 ? baseSlug.slice(0, 160) : baseSlug;
      let candidate = trimmedBase;
      let counter = 1;

      while (true) {
         const existing = await this.supplierRepository.findBySlug(candidate);
         if (!existing || (excludeSupplierId && existing.supplierId === excludeSupplierId)) {
            return candidate;
         }
         candidate = `${trimmedBase}-${counter}`;
         counter++;
      }
   }
}
