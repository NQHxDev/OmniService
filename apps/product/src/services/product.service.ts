import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { uuidv7 } from '@common';
import {
   CURRENCY,
   MODERATION_STATUS,
   PRODUCT_ERROR_CODES,
   PRODUCT_STATUS,
   type CreateProductDto,
   type CurrencyType,
   type ListProductsQueryDto,
   type ModerateProductDto,
   type ProductItemDto,
   type UpdateProductDto,
   type UpdateProductStatusDto,
} from '@contracts/product';
import { ProductSlug, Sku } from '@product/domain';
import { ProductEntity } from '@product/entities';
import { PRODUCT_EVENT_PUBLISHER, type IProductEventPublisher } from '@product/publishers';
import { PRODUCT_UNIT_OF_WORK, type IProductUnitOfWork } from '@product/unit-of-work';
import { OutboxService } from '@product/outbox';

@Injectable()
export class ProductService {
   constructor(
      @Inject(PRODUCT_UNIT_OF_WORK)
      private readonly uow: IProductUnitOfWork,
      @Inject(PRODUCT_EVENT_PUBLISHER)
      private readonly publisher: IProductEventPublisher,
      private readonly outboxService: OutboxService,
   ) {}

   private mapEntityToDto(entity: ProductEntity): ProductItemDto {
      return {
         productId: entity.productId,
         supplierId: entity.supplierId,
         whoCategoryCode: entity.whoCategoryCode as never,
         productName: entity.productName,
         productSlug: entity.productSlug,
         description: entity.description,
         origin: entity.origin || undefined,
         storageCondition: entity.storageCondition || undefined,
         shelfLifeDays: entity.shelfLifeDays || undefined,
         images: entity.images,
         status: entity.status as never,
         moderationStatus: entity.moderationStatus as never,
         rejectionReason: entity.rejectionReason || undefined,
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

   async createProduct(supplierId: string, dto: CreateProductDto): Promise<ProductItemDto> {
      // 1. Verify WHO category exists
      return this.uow.runInTransaction(async (repos) => {
         const category = await repos.whoCategoryRepository.findByCode(dto.whoCategoryCode);
         if (!category) {
            throw new BadRequestException({
               code: PRODUCT_ERROR_CODES.WHO_CATEGORY_INVALID,
               message: `Invalid WHO food category code: ${dto.whoCategoryCode}`,
            });
         }

         const productId = uuidv7();
         const slugResult = ProductSlug.create(dto.productName, productId);
         if (slugResult.isFailure()) {
            throw new BadRequestException({
               code: PRODUCT_ERROR_CODES.PRODUCT_INVALID_DATA,
               message: 'Invalid product name',
            });
         }
         const slugVo = slugResult.getValue();

         // Validate SKUs
         for (const v of dto.variants) {
            Sku.create(v.sku);
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

         // Write transactional outbox
         await this.outboxService.emitEvent({
            aggregateId: productId,
            aggregateType: 'PRODUCT',
            eventType: 'PRODUCT_REGISTERED',
            payload: {
               productId,
               supplierId,
               whoCategoryCode: dto.whoCategoryCode,
               productName: dto.productName,
               productSlug: slugVo.value,
               description: dto.description,
               origin: dto.origin,
               images: dto.images || [],
               status: PRODUCT_STATUS.DRAFT,
               moderationStatus: MODERATION_STATUS.PENDING_APPROVAL,
               variants: createdVariants.map((v) => ({
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
               createdAt: createdProduct.createdAt.toISOString(),
            },
         });

         // Sync immediately to Search Service (RabbitMQ) even though unapproved
         await this.publisher.publishProductRegistered({
            productId,
            supplierId,
            whoCategoryCode: dto.whoCategoryCode,
            productName: dto.productName,
            productSlug: slugVo.value,
            description: dto.description,
            origin: dto.origin,
            images: dto.images || [],
            status: PRODUCT_STATUS.DRAFT,
            moderationStatus: MODERATION_STATUS.PENDING_APPROVAL,
            variants: createdVariants.map((v) => ({
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
            createdAt: createdProduct.createdAt.toISOString(),
         });

         return resultDto;
      });
   }

   async updateProduct(productId: string, supplierId: string, dto: UpdateProductDto): Promise<ProductItemDto> {
      return this.uow.runInTransaction(async (repos) => {
         const existing = await repos.productRepository.findById(productId);
         if (!existing) {
            throw new NotFoundException({
               code: PRODUCT_ERROR_CODES.PRODUCT_NOT_FOUND,
               message: `Product ${productId} not found`,
            });
         }

         if (existing.supplierId !== supplierId) {
            throw new BadRequestException({
               code: PRODUCT_ERROR_CODES.PRODUCT_NOT_OWNED,
               message: `You do not own product ${productId}`,
            });
         }

         let slugValue: string | undefined;
         let normalizedName: string | undefined;
         if (dto.productName && dto.productName !== existing.productName) {
            const slugResult = ProductSlug.create(dto.productName, productId);
            if (slugResult.isFailure()) {
               throw new BadRequestException({
                  code: PRODUCT_ERROR_CODES.PRODUCT_INVALID_DATA,
                  message: 'Invalid product name',
               });
            }
            const slugVo = slugResult.getValue();
            slugValue = slugVo.value;
            normalizedName = slugVo.normalizedName;
         }

         const updated = await repos.productRepository.update(productId, {
            productName: dto.productName,
            normalizedName,
            productSlug: slugValue,
            description: dto.description,
            origin: dto.origin,
            storageCondition: dto.storageCondition,
            shelfLifeDays: dto.shelfLifeDays,
            images: dto.images,
         });

         return this.mapEntityToDto(updated);
      });
   }

   async moderateProduct(productId: string, moderatorId: string, dto: ModerateProductDto): Promise<ProductItemDto> {
      return this.uow.runInTransaction(async (repos) => {
         const existing = await repos.productRepository.findById(productId);
         if (!existing) {
            throw new NotFoundException({
               code: PRODUCT_ERROR_CODES.PRODUCT_NOT_FOUND,
               message: `Product ${productId} not found`,
            });
         }

         if (dto.moderationStatus === MODERATION_STATUS.REJECTED && !dto.rejectionReason?.trim()) {
            throw new BadRequestException({
               code: PRODUCT_ERROR_CODES.MODERATION_REJECTION_REASON_REQUIRED,
               message: 'Rejection reason is required when rejecting a product',
            });
         }

         const now = new Date();
         const updated = await repos.productRepository.update(productId, {
            moderationStatus: dto.moderationStatus,
            rejectionReason: dto.moderationStatus === MODERATION_STATUS.REJECTED ? dto.rejectionReason : null,
            moderatedBy: moderatorId,
            moderatedAt: now,
            // If approved, activate status automatically or let supplier activate
            status:
               dto.moderationStatus === MODERATION_STATUS.APPROVED ? PRODUCT_STATUS.ACTIVE : PRODUCT_STATUS.INACTIVE,
         });

         const payload = {
            productId,
            supplierId: updated.supplierId,
            moderationStatus: dto.moderationStatus,
            rejectionReason: dto.rejectionReason,
            moderatedBy: moderatorId,
            moderatedAt: now.toISOString(),
         };

         await this.outboxService.emitEvent({
            aggregateId: productId,
            aggregateType: 'PRODUCT',
            eventType: dto.moderationStatus === MODERATION_STATUS.APPROVED ? 'PRODUCT_APPROVED' : 'PRODUCT_REJECTED',
            payload,
         });

         if (dto.moderationStatus === MODERATION_STATUS.APPROVED) {
            await this.publisher.publishProductApproved(payload);
         } else {
            await this.publisher.publishProductRejected(payload);
         }

         return this.mapEntityToDto(updated);
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
            throw new NotFoundException({
               code: PRODUCT_ERROR_CODES.PRODUCT_NOT_FOUND,
               message: `Product ${productId} not found`,
            });
         }

         if (existing.supplierId !== supplierId) {
            throw new BadRequestException({
               code: PRODUCT_ERROR_CODES.PRODUCT_NOT_OWNED,
               message: `You do not own product ${productId}`,
            });
         }

         // Enforce moderation rule: cannot active unapproved product!
         if (dto.status === PRODUCT_STATUS.ACTIVE && existing.moderationStatus !== MODERATION_STATUS.APPROVED) {
            throw new BadRequestException({
               code: PRODUCT_ERROR_CODES.CANNOT_ACTIVATE_UNAPPROVED_PRODUCT,
               message: 'Cannot activate product before admin approval',
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
            throw new NotFoundException({
               code: PRODUCT_ERROR_CODES.PRODUCT_NOT_FOUND,
               message: `Product ${productId} not found`,
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

   async listWhoCategories() {
      return this.uow.runInTransaction(async (repos) => {
         return repos.whoCategoryRepository.findAll();
      });
   }
}
