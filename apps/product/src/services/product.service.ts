import { Inject, Injectable, Optional } from '@nestjs/common';
import { BadRequestException, CacheNamespace, CacheService, NotFoundException, uuidv7 } from '@common';
import {
   CURRENCY,
   MODERATION_ACTION,
   MODERATION_STATUS,
   PRODUCT_AGGREGATE_TYPE,
   PRODUCT_CACHE_KEYS,
   PRODUCT_CACHE_TTL,
   PRODUCT_ERROR_CODES,
   PRODUCT_FIELDS,
   PRODUCT_OUTBOX_EVENTS,
   PRODUCT_STATUS,
   WhoCategoryCode,
   type CreateProductDto,
   type CurrencyType,
   type ListProductsQueryDto,
   type ModerateProductDto,
   type ModerationStatusType,
   type ProductItemDto,
   type ProductModeratedEventPayload,
   type ProductModerationHistoryDto,
   type ProductRegisteredEventPayload,
   type ProductStatusType,
   type UpdateProductDto,
   type UpdateProductStatusDto,
} from '@contracts/product';
import { ProductModerationStateMachine, ProductSlug, Sku } from '@product/domain';
import { ProductEntity, ProductVariantEntity, WhoCategoryEntity } from '@product/entities';
import { PRODUCT_EVENT_PUBLISHER, type IProductEventPublisher } from '@product/publishers';
import { PRODUCT_UNIT_OF_WORK, type IProductUnitOfWork } from '@product/unit-of-work';
import { OutboxService } from '@product/outbox';
import type { UpdateProductInput } from '@product/repositories';

export const WHO_CATEGORIES_CACHE_KEY = PRODUCT_CACHE_KEYS.WHO_CATEGORIES_ALL;

@Injectable()
export class ProductService {
   constructor(
      @Inject(PRODUCT_UNIT_OF_WORK)
      private readonly uow: IProductUnitOfWork,
      @Inject(PRODUCT_EVENT_PUBLISHER)
      private readonly publisher: IProductEventPublisher,
      private readonly outboxService: OutboxService,
      @Optional() private readonly cacheService?: CacheService,
   ) {}

   private mapEntityToDto(entity: ProductEntity): ProductItemDto {
      return {
         productId: entity.productId,
         supplierId: entity.supplierId,
         whoCategoryCode: entity.whoCategoryCode as WhoCategoryCode,
         productName: entity.productName,
         productSlug: entity.productSlug,
         description: entity.description,
         origin: entity.origin || undefined,
         storageCondition: entity.storageCondition || undefined,
         shelfLifeDays: entity.shelfLifeDays || undefined,
         images: entity.images,
         status: entity.status as ProductStatusType,
         moderationStatus: entity.moderationStatus as ModerationStatusType,
         rejectionReason: entity.rejectionReason || undefined,
         pendingEditData: entity.pendingEditData || undefined,
         variants: (entity.variants || []).map((v) => ({
            variantId: v.variantId,
            productId: v.productId,
            sku: v.sku,
            variantName: v.variantName,
            unit: v.unit,
            packSize: v.packSize || undefined,
            price: v.price,
            originalPrice: v.originalPrice || undefined,
            currency: (v.currency as CurrencyType) || CURRENCY.VND,
            stockQuantity: v.stockQuantity,
            reservedQuantity: v.reservedQuantity,
            availableStock: v.stockQuantity - v.reservedQuantity,
            lowStockThreshold: v.lowStockThreshold,
            isDefault: v.isDefault,
            status: v.status as never,
            createdAt: v.createdAt.toISOString(),
            updatedAt: v.updatedAt.toISOString(),
         })),
         version: entity.version,
         createdAt: entity.createdAt.toISOString(),
         updatedAt: entity.updatedAt.toISOString(),
      };
   }

   private buildProductRegisteredEventPayload(
      product: ProductEntity,
      variants?: ProductVariantEntity[],
   ): ProductRegisteredEventPayload {
      const targetVariants = variants || product.variants || [];
      return {
         productId: product.productId,
         supplierId: product.supplierId,
         whoCategoryCode: product.whoCategoryCode,
         productName: product.productName,
         normalizedName: product.normalizedName,
         productSlug: product.productSlug,
         description: product.description,
         origin: product.origin || undefined,
         storageCondition: product.storageCondition || undefined,
         shelfLifeDays: product.shelfLifeDays || undefined,
         images: product.images || [],
         status: product.status,
         moderationStatus: product.moderationStatus,
         variants: targetVariants.map((v) => ({
            variantId: v.variantId,
            sku: v.sku,
            variantName: v.variantName,
            unit: v.unit,
            packSize: v.packSize || undefined,
            price: v.price,
            originalPrice: v.originalPrice || undefined,
            currency: v.currency,
            stockQuantity: v.stockQuantity,
            lowStockThreshold: v.lowStockThreshold,
            isDefault: v.isDefault,
            status: v.status,
         })),
         createdAt: product.createdAt.toISOString(),
      };
   }

   async createProduct(supplierId: string, dto: CreateProductDto): Promise<ProductItemDto> {
      // 1. Verify WHO category exists
      return this.uow.runInTransaction(async (repos) => {
         const category = await repos.whoCategoryRepository.findByCode(dto.whoCategoryCode);
         if (!category) {
            throw new BadRequestException(PRODUCT_ERROR_CODES.WHO_CATEGORY_INVALID, {
               params: { code: dto.whoCategoryCode },
            });
         }

         const productId = uuidv7();
         const slugResult = ProductSlug.create(dto.productName, productId);
         if (slugResult.isFailure()) {
            throw new BadRequestException(PRODUCT_ERROR_CODES.PRODUCT_INVALID_DATA, {
               params: { field: 'productName' },
            });
         }
         const slugVo = slugResult.getValue();

         // Validate SKUs
         for (const v of dto.variants) {
            const skuResult = Sku.create(v.sku);
            if (skuResult.isFailure()) {
               throw new BadRequestException(PRODUCT_ERROR_CODES.VARIANT_INVALID, {
                  params: { sku: v.sku },
               });
            }
         }

         const createdProduct = await repos.productRepository.create({
            productId,
            supplierId,
            whoCategoryCode: dto.whoCategoryCode,
            productName: dto.productName,
            normalizedName: slugVo.normalizedName,
            productSlug: slugVo.value,
            description: dto.description,
            origin: dto.origin,
            storageCondition: dto.storageCondition,
            shelfLifeDays: dto.shelfLifeDays,
            images: dto.images || [],
            status: PRODUCT_STATUS.DRAFT,
            moderationStatus: MODERATION_STATUS.PENDING_APPROVAL,
         });

         const createdVariants = await repos.productVariantRepository.createMany(
            dto.variants.map((v, idx) => ({
               variantId: uuidv7(),
               productId,
               sku: v.sku.toUpperCase().trim(),
               variantName: v.variantName,
               unit: v.unit,
               packSize: v.packSize,
               price: v.price,
               originalPrice: v.originalPrice,
               currency: v.currency || CURRENCY.VND,
               stockQuantity: v.stockQuantity,
               lowStockThreshold: v.lowStockThreshold || 5,
               isDefault: v.isDefault !== undefined ? v.isDefault : idx === 0,
               status: PRODUCT_STATUS.ACTIVE,
            })),
         );

         createdProduct.variants = createdVariants;
         const resultDto = this.mapEntityToDto(createdProduct);
         const eventPayload = this.buildProductRegisteredEventPayload(createdProduct, createdVariants);

         // Write transactional outbox
         await this.outboxService.emitEvent({
            aggregateId: productId,
            aggregateType: PRODUCT_AGGREGATE_TYPE,
            eventType: PRODUCT_OUTBOX_EVENTS.REGISTERED,
            payload: eventPayload as unknown as Record<string, unknown>,
         });

         // Publish domain event (Search indexing will only occur after admin approval)
         await this.publisher.publishProductRegistered(eventPayload);

         return resultDto;
      });
   }

   async updateProduct(productId: string, supplierId: string, dto: UpdateProductDto): Promise<ProductItemDto> {
      return this.uow.runInTransaction(async (repos) => {
         const existing = await repos.productRepository.findById(productId);
         if (!existing) {
            throw new NotFoundException(PRODUCT_ERROR_CODES.PRODUCT_NOT_FOUND, {
               params: { id: productId },
            });
         }

         if (existing.supplierId !== supplierId) {
            throw new BadRequestException(PRODUCT_ERROR_CODES.PRODUCT_NOT_OWNED, {
               params: { id: productId },
            });
         }

         if (existing.moderationStatus === MODERATION_STATUS.PENDING_APPROVAL) {
            throw new BadRequestException(PRODUCT_ERROR_CODES.CANNOT_EDIT_WHILE_PENDING_APPROVAL, {
               params: { id: productId },
            });
         }

         let slugValue: string | undefined;
         let normalizedName: string | undefined;
         if (dto.productName && dto.productName !== existing.productName) {
            const slugResult = ProductSlug.create(dto.productName, productId);
            if (slugResult.isFailure()) {
               throw new BadRequestException(PRODUCT_ERROR_CODES.PRODUCT_INVALID_DATA, {
                  params: { field: PRODUCT_FIELDS.PRODUCT_NAME },
               });
            }
            const slugVo = slugResult.getValue();
            slugValue = slugVo.value;
            normalizedName = slugVo.normalizedName;
         }

         // Live Version vs Pending Edit Draft
         // When product is APPROVED or ACTIVE, Supplier edits are staged into pendingEditData
         if (existing.moderationStatus === MODERATION_STATUS.APPROVED || existing.status === PRODUCT_STATUS.ACTIVE) {
            const editDraft: Record<string, unknown> = {
               productName: dto.productName ?? existing.productName,
               normalizedName: normalizedName ?? existing.normalizedName,
               productSlug: slugValue ?? existing.productSlug,
               description: dto.description ?? existing.description,
               origin: dto.origin !== undefined ? dto.origin : existing.origin,
               storageCondition: dto.storageCondition !== undefined ? dto.storageCondition : existing.storageCondition,
               shelfLifeDays: dto.shelfLifeDays !== undefined ? dto.shelfLifeDays : existing.shelfLifeDays,
               images: dto.images ?? existing.images,
               whoCategoryCode: dto.whoCategoryCode ?? existing.whoCategoryCode,
               editedAt: new Date().toISOString(),
            };

            const updated = await repos.productRepository.update(productId, {
               pendingEditData: editDraft,
               moderationStatus: MODERATION_STATUS.EDIT_PENDING_APPROVAL,
            });

            return this.mapEntityToDto(updated);
         }

         // Direct edit for DRAFT or REJECTED products
         const updated = await repos.productRepository.update(productId, {
            whoCategoryCode: dto.whoCategoryCode,
            productName: dto.productName,
            normalizedName,
            productSlug: slugValue,
            description: dto.description,
            origin: dto.origin,
            storageCondition: dto.storageCondition,
            shelfLifeDays: dto.shelfLifeDays,
            images: dto.images,
            moderationStatus: MODERATION_STATUS.DRAFT,
         });

         return this.mapEntityToDto(updated);
      });
   }

   async submitProductForReview(productId: string, supplierId: string): Promise<ProductItemDto> {
      return this.uow.runInTransaction(async (repos) => {
         const existing = await repos.productRepository.findById(productId);
         if (!existing) {
            throw new NotFoundException(PRODUCT_ERROR_CODES.PRODUCT_NOT_FOUND, {
               params: { id: productId },
            });
         }

         if (existing.supplierId !== supplierId) {
            throw new BadRequestException(PRODUCT_ERROR_CODES.PRODUCT_NOT_OWNED, {
               params: { id: productId },
            });
         }

         const transition = ProductModerationStateMachine.transitionOnSubmitForReview(
            existing.moderationStatus as ModerationStatusType,
         );

         const updated = await repos.productRepository.update(productId, {
            moderationStatus: transition.newModerationStatus,
         });

         return this.mapEntityToDto(updated);
      });
   }

   async moderateProduct(
      productId: string,
      moderatorId: string,
      dto: ModerateProductDto,
      moderatorEmail?: string,
   ): Promise<ProductItemDto> {
      return this.uow.runInTransaction(async (repos) => {
         const existing = await repos.productRepository.findById(productId);
         if (!existing) {
            throw new NotFoundException(PRODUCT_ERROR_CODES.PRODUCT_NOT_FOUND, {
               params: { id: productId },
            });
         }

         const transition = ProductModerationStateMachine.transitionOnModeration(
            existing.moderationStatus as ModerationStatusType,
            existing.status as ProductStatusType,
            dto.moderationStatus,
            dto.action,
            dto.rejectionReason,
            existing.pendingEditData,
         );

         const now = new Date();
         const updatePayload: UpdateProductInput = {
            moderationStatus: transition.newModerationStatus,
            status: transition.newProductStatus,
            rejectionReason:
               dto.moderationStatus === MODERATION_STATUS.REJECTED ||
               transition.action === MODERATION_ACTION.REJECT_EDIT
                  ? dto.rejectionReason
                  : null,
            moderatedBy: moderatorId,
            moderatedAt: now,
         };

         if (transition.applyPendingEdit && transition.updatedFields) {
            const draft = transition.updatedFields;
            if (typeof draft.productName === 'string') updatePayload.productName = draft.productName;
            if (typeof draft.normalizedName === 'string') updatePayload.normalizedName = draft.normalizedName;
            if (typeof draft.productSlug === 'string') updatePayload.productSlug = draft.productSlug;
            if (typeof draft.description === 'string') updatePayload.description = draft.description;
            if (draft.origin !== undefined) updatePayload.origin = draft.origin as string;
            if (draft.storageCondition !== undefined) updatePayload.storageCondition = draft.storageCondition as string;
            if (draft.shelfLifeDays !== undefined) updatePayload.shelfLifeDays = draft.shelfLifeDays as number;
            if (Array.isArray(draft.images)) updatePayload.images = draft.images;
            if (typeof draft.whoCategoryCode === 'string') updatePayload.whoCategoryCode = draft.whoCategoryCode;
            updatePayload.pendingEditData = null;
         } else if (transition.clearPendingEdit) {
            updatePayload.pendingEditData = null;
         }

         const updated = await repos.productRepository.update(productId, updatePayload);

         // Snapshot for audit trail
         const snapshot: Record<string, unknown> = {
            productId: existing.productId,
            productName: existing.productName,
            status: existing.status,
            moderationStatus: existing.moderationStatus,
            pendingEditData: existing.pendingEditData,
            images: existing.images,
            version: existing.version,
         };

         // Write audit history record
         await repos.moderationHistoryRepository.create({
            productId,
            moderatorId,
            moderatorEmail: moderatorEmail || null,
            action: transition.action,
            previousStatus: existing.moderationStatus,
            newStatus: transition.newModerationStatus,
            rejectionReason: dto.rejectionReason || null,
            moderationNotes: dto.moderationNotes || null,
            snapshot,
         });

         const prices = (updated.variants || []).map((v) => v.price).filter((p) => typeof p === 'number' && !isNaN(p));
         const minPrice = prices.length > 0 ? Math.min(...prices) : undefined;
         const maxPrice = prices.length > 0 ? Math.max(...prices) : undefined;
         const currency = (updated.variants?.[0]?.currency as CurrencyType) || CURRENCY.VND;

         const eventPayload: ProductModeratedEventPayload = {
            productId,
            supplierId: updated.supplierId,
            productName: updated.productName,
            moderationStatus: updated.moderationStatus,
            action: transition.action,
            rejectionReason: dto.rejectionReason,
            moderationNotes: dto.moderationNotes,
            moderatedBy: moderatorId,
            moderatorEmail,
            moderatedAt: now.toISOString(),
            whoCategoryCode: updated.whoCategoryCode,
            productSlug: updated.productSlug,
            description: updated.description,
            origin: updated.origin || undefined,
            storageCondition: updated.storageCondition || undefined,
            shelfLifeDays: updated.shelfLifeDays || undefined,
            images: updated.images || [],
            status: updated.status,
            variants: (updated.variants || []).map((v) => ({
               variantId: v.variantId,
               sku: v.sku,
               variantName: v.variantName,
               unit: v.unit,
               packSize: v.packSize || undefined,
               price: v.price,
               originalPrice: v.originalPrice || undefined,
               currency: v.currency,
               stockQuantity: v.stockQuantity,
               lowStockThreshold: v.lowStockThreshold,
               isDefault: v.isDefault,
               status: v.status,
            })),
            minPrice,
            maxPrice,
            currency,
            createdAt: updated.createdAt.toISOString(),
         };

         const eventType =
            transition.action === MODERATION_ACTION.SUSPEND
               ? PRODUCT_OUTBOX_EVENTS.SUSPENDED
               : transition.newModerationStatus === MODERATION_STATUS.APPROVED
                 ? PRODUCT_OUTBOX_EVENTS.APPROVED
                 : PRODUCT_OUTBOX_EVENTS.REJECTED;

         await this.outboxService.emitEvent({
            aggregateId: productId,
            aggregateType: PRODUCT_AGGREGATE_TYPE,
            eventType,
            payload: eventPayload as unknown as Record<string, unknown>,
         });

         if (transition.action === MODERATION_ACTION.SUSPEND) {
            await this.publisher.publishProductSuspended(eventPayload);
         } else if (transition.newModerationStatus === MODERATION_STATUS.APPROVED) {
            await this.publisher.publishProductApproved(eventPayload);
         } else {
            await this.publisher.publishProductRejected(eventPayload);
         }

         return this.mapEntityToDto(updated);
      });
   }

   async getProductModerationHistory(productId: string): Promise<ProductModerationHistoryDto[]> {
      return this.uow.runInTransaction(async (repos) => {
         const existing = await repos.productRepository.findById(productId);
         if (!existing) {
            throw new NotFoundException(PRODUCT_ERROR_CODES.PRODUCT_NOT_FOUND, {
               params: { id: productId },
            });
         }

         const histories = await repos.moderationHistoryRepository.findByProductId(productId);
         return histories.map((h) => ({
            historyId: h.historyId,
            productId: h.productId,
            moderatorId: h.moderatorId,
            moderatorEmail: h.moderatorEmail || undefined,
            action: h.action as never,
            previousStatus: h.previousStatus as never,
            newStatus: h.newStatus as never,
            rejectionReason: h.rejectionReason || undefined,
            moderationNotes: h.moderationNotes || undefined,
            snapshot: h.snapshot || undefined,
            createdAt: h.createdAt.toISOString(),
         }));
      });
   }

   async updateProductStatus(
      productId: string,
      supplierId: string,
      dto: UpdateProductStatusDto,
   ): Promise<ProductItemDto> {
      return this.uow.runInTransaction(async (repos) => {
         const existing = await repos.productRepository.findById(productId);
         if (!existing) {
            throw new NotFoundException(PRODUCT_ERROR_CODES.PRODUCT_NOT_FOUND, {
               params: { id: productId },
            });
         }

         if (existing.supplierId !== supplierId) {
            throw new BadRequestException(PRODUCT_ERROR_CODES.PRODUCT_NOT_OWNED, {
               params: { id: productId },
            });
         }

         // Enforce moderation rule: cannot active unapproved product!
         if (dto.status === PRODUCT_STATUS.ACTIVE && existing.moderationStatus !== MODERATION_STATUS.APPROVED) {
            throw new BadRequestException(PRODUCT_ERROR_CODES.CANNOT_ACTIVATE_UNAPPROVED_PRODUCT, {
               params: { id: productId },
            });
         }

         const updated = await repos.productRepository.update(productId, {
            status: dto.status,
         });

         await this.publisher.publishProductStatusChanged({
            productId,
            supplierId: existing.supplierId,
            status: dto.status,
            updatedAt: new Date().toISOString(),
         });

         return this.mapEntityToDto(updated);
      });
   }

   async getProductById(productId: string): Promise<ProductItemDto> {
      return this.uow.runInTransaction(async (repos) => {
         const existing = await repos.productRepository.findById(productId);
         if (!existing) {
            throw new NotFoundException(PRODUCT_ERROR_CODES.PRODUCT_NOT_FOUND, {
               params: { id: productId },
            });
         }
         return this.mapEntityToDto(existing);
      });
   }

   async getProductsByIds(productIds: string[]): Promise<ProductItemDto[]> {
      return this.uow.runInTransaction(async (repos) => {
         const products = await repos.productRepository.findByIds(productIds);
         return products.map((p) => this.mapEntityToDto(p));
      });
   }

   async listProducts(query: ListProductsQueryDto): Promise<{ items: ProductItemDto[]; total: number }> {
      return this.uow.runInTransaction(async (repos) => {
         const { items, total } = await repos.productRepository.findMany({
            supplierId: query.supplierId,
            whoCategoryCode: query.whoCategoryCode,
            status: query.status,
            moderationStatus: query.moderationStatus,
            search: query.search,
            limit: query.limit,
            offset: query.offset,
         });

         return {
            items: items.map((p) => this.mapEntityToDto(p)),
            total,
         };
      });
   }

   async listWhoCategories(): Promise<WhoCategoryEntity[]> {
      if (this.cacheService) {
         try {
            const cached = await this.cacheService.get<WhoCategoryEntity[]>(
               CacheNamespace.PRODUCT,
               WHO_CATEGORIES_CACHE_KEY,
            );
            if (cached && Array.isArray(cached) && cached.length > 0) {
               return cached;
            }
         } catch {
            // Degrade gracefully if cache is unreachable
         }
      }

      const categories = await this.uow.runInTransaction(async (repos) => {
         return repos.whoCategoryRepository.findAll();
      });

      if (this.cacheService && categories.length > 0) {
         try {
            await this.cacheService.set(
               CacheNamespace.PRODUCT,
               WHO_CATEGORIES_CACHE_KEY,
               categories,
               PRODUCT_CACHE_TTL.WHO_CATEGORIES_SECONDS,
            );
         } catch {
            // Degrade gracefully if cache is unreachable
         }
      }

      return categories;
   }
}
