import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BadRequestException, ConflictException, NotFoundException } from '@common';
import {
   SUPPLIER_ERROR_CODES,
   SUPPLIER_EVENTS,
   SUPPLIER_STATUS,
   type RegisterSupplierDto,
   type SupplierStatusType,
   type UpdateSupplierDto,
} from '@contracts/supplier';
import { SUPPLIER_REPOSITORY, type FindSuppliersParams, type ISupplierRepository } from '@supplier/repositories';
import { Slug, SupplierCode } from '@supplier/domain/value-objects';
import {
   SupplierRegisteredEvent,
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
      const existingBySlug = await this.supplierRepository.findBySlug(slugVo.value);
      if (existingBySlug) {
         throw new ConflictException(SUPPLIER_ERROR_CODES.SUPPLIER_SLUG_ALREADY_EXISTS, {
            params: { slug: slugVo.value },
         });
      }

      const created = await this.supplierRepository.create({
         supplierName: dto.supplierName.trim(),
         supplierSlug: slugVo.value,
         supplierCode: codeVo.value,
         contactEmail: dto.contactEmail?.trim(),
         contactPhone: dto.contactPhone?.trim(),
         address: dto.address?.trim(),
         city: dto.city?.trim(),
         supplierLogoUrl: dto.supplierLogoUrl,
         isVerified: false,
         supplierStatus: SUPPLIER_STATUS.ACTIVE,
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
         newSlug = new Slug(dto.supplierName).value;
         const existingBySlug = await this.supplierRepository.findBySlug(newSlug);
         if (existingBySlug && existingBySlug.supplierId !== supplierId) {
            throw new ConflictException(SUPPLIER_ERROR_CODES.SUPPLIER_SLUG_ALREADY_EXISTS, {
               params: { slug: newSlug },
            });
         }
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

   async verifySupplier(supplierId: string, isVerified: boolean): Promise<SupplierEntity> {
      const existing = await this.supplierRepository.findById(supplierId);
      if (!existing) {
         throw new NotFoundException(SUPPLIER_ERROR_CODES.SUPPLIER_NOT_FOUND, {
            params: { supplierId },
         });
      }

      const updated = await this.supplierRepository.update(supplierId, { isVerified });
      if (!updated) {
         throw new NotFoundException(SUPPLIER_ERROR_CODES.SUPPLIER_NOT_FOUND, {
            params: { supplierId },
         });
      }

      this.eventEmitter.emit(SUPPLIER_EVENTS.SUPPLIER_VERIFIED, new SupplierVerifiedEvent(supplierId, isVerified));

      return updated;
   }
}
