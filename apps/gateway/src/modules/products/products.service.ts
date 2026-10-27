import { Inject, Injectable, Optional, type OnModuleInit } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { defer, firstValueFrom } from 'rxjs';
import {
   CacheNamespace,
   CacheService,
   CircuitBreakerRegistry,
   createGrpcMetadata,
   handleGrpcError,
   NotFoundException,
   RetryPolicyRegistry,
   SERVICE_NAMES,
   withGrpcRetry,
} from '@common';
import {
   CURRENCY,
   type CurrencyType,
   PRODUCT_CACHE_KEYS,
   PRODUCT_CACHE_TTL,
   PRODUCT_ERROR_CODES,
   PRODUCT_V1_GRPC_CLIENT,
   PRODUCT_V1_GRPC_SERVICE_NAME,
   type AdjustStockDto,
   type CheckAndReserveStockDto,
   type CheckAndReserveStockResponseDto,
   type CreateProductDto,
   type IAdjustStockRequest,
   type ICheckAndReserveStockRequest,
   type ICreateProductRequest,
   type IGetProductByIdRequest,
   type IGetProductModerationHistoryRequest,
   type IListProductsRequest,
   type IModerateProductRequest,
   type IProductProto,
   type IProductV1GrpcService,
   type IReleaseStockRequest,
   type ISubmitProductForReviewRequest,
   type IUpdateProductRequest,
   type IUpdateProductStatusRequest,
   type ListProductsQueryDto,
   type ListProductsResponseDto,
   type ModerateProductDto,
   type ProductItemDto,
   type ProductModerationHistoryDto,
   type ProductSearchItemDto,
   type ProductSuggestionItemDto,
   type ReleaseStockDto,
   type SearchProductsQueryDto,
   type SearchProductsResponseDto,
   type SuggestProductsQueryDto,
   type SuggestProductsResponseDto,
   type UpdateProductDto,
   type UpdateProductStatusDto,
   type WhoCategoryDto,
} from '@contracts/product';
import {
   SEARCH_V1_GRPC_CLIENT,
   SEARCH_V1_GRPC_SERVICE_NAME,
   type IProductSearchHitProto,
   type IProductSuggestionProto,
   type ISearchProductsRequest,
   type ISearchV1GrpcService,
   type ISuggestProductsRequest,
} from '@contracts/search';

export interface ProductCallOptions {
   authHeader?: string;
   correlationId?: string;
   accountId?: string;
   roles?: string[];
   permissions?: string[];
   email?: string;
}

@Injectable()
export class ProductsService implements OnModuleInit {
   private productGrpcService!: IProductV1GrpcService;
   private searchGrpcService!: ISearchV1GrpcService;
   private readonly productGrpcBreaker = CircuitBreakerRegistry.getOrCreate(PRODUCT_V1_GRPC_SERVICE_NAME, {
      timeout: 5000,
      failureThreshold: 5,
      resetTimeout: 10000,
   });
   private readonly productGrpcRetryPolicy = RetryPolicyRegistry.getOrCreate(PRODUCT_V1_GRPC_SERVICE_NAME, {
      maxAttempts: 3,
      initialDelayMs: 100,
      multiplier: 2,
      maxDelayMs: 2000,
   });
   private readonly searchGrpcBreaker = CircuitBreakerRegistry.getOrCreate(`${SEARCH_V1_GRPC_SERVICE_NAME}_products`, {
      timeout: 5000,
      failureThreshold: 5,
      resetTimeout: 10000,
   });
   private readonly searchGrpcRetryPolicy = RetryPolicyRegistry.getOrCreate(`${SEARCH_V1_GRPC_SERVICE_NAME}_products`, {
      maxAttempts: 3,
      initialDelayMs: 100,
      multiplier: 2,
      maxDelayMs: 2000,
   });

   constructor(
      @Inject(PRODUCT_V1_GRPC_CLIENT) private readonly productGrpcClient: ClientGrpc,
      @Inject(SEARCH_V1_GRPC_CLIENT) private readonly searchGrpcClient: ClientGrpc,
      @Optional() private readonly cacheService?: CacheService,
   ) {}

   onModuleInit(): void {
      this.productGrpcService = this.productGrpcClient.getService<IProductV1GrpcService>(PRODUCT_V1_GRPC_SERVICE_NAME);
      this.searchGrpcService = this.searchGrpcClient.getService<ISearchV1GrpcService>(SEARCH_V1_GRPC_SERVICE_NAME);
   }

   private mapProtoToDto(p: IProductProto): ProductItemDto {
      return {
         productId: p.productId,
         supplierId: p.supplierId,
         whoCategoryCode: p.whoCategoryCode as never,
         productName: p.productName,
         productSlug: p.productSlug,
         description: p.description,
         origin: p.origin || undefined,
         storageCondition: p.storageCondition || undefined,
         shelfLifeDays: p.shelfLifeDays || undefined,
         images: p.images || [],
         status: p.status as never,
         moderationStatus: p.moderationStatus as never,
         rejectionReason: p.rejectionReason || undefined,
         pendingEditData: p.pendingEditData ? (JSON.parse(p.pendingEditData) as Record<string, unknown>) : undefined,
         variants: (p.variants || []).map((v) => ({
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
            createdAt: p.createdAt,
            updatedAt: p.updatedAt,
         })),
         version: p.version,
         createdAt: p.createdAt,
         updatedAt: p.updatedAt,
      };
   }

   private mapSearchHitProtoToDto(p: IProductSearchHitProto): ProductSearchItemDto {
      return {
         productId: p.productId,
         supplierId: p.supplierId,
         whoCategoryCode: p.whoCategoryCode as never,
         productName: p.productName,
         productSlug: p.productSlug,
         description: p.description,
         origin: p.origin || undefined,
         images: p.images || [],
         status: p.status as never,
         moderationStatus: p.moderationStatus as never,
         variants: (p.variants || []).map((v) => ({
            variantId: v.variantId,
            productId: p.productId,
            sku: v.sku,
            variantName: v.variantName,
            unit: v.unit,
            packSize: v.packSize || undefined,
            price: v.price,
            originalPrice: v.originalPrice || undefined,
            currency: (v.currency as CurrencyType) || CURRENCY.VND,
            stockQuantity: v.stockQuantity,
            reservedQuantity: 0,
            availableStock: v.stockQuantity,
            lowStockThreshold: 5,
            isDefault: v.isDefault,
            status: v.status as never,
            createdAt: p.createdAt,
            updatedAt: p.updatedAt,
         })),
         minPrice: p.minPrice || undefined,
         maxPrice: p.maxPrice || undefined,
         currency: (p.currency as CurrencyType) || undefined,
         createdAt: p.createdAt,
         updatedAt: p.updatedAt,
      };
   }

   private mapSuggestionProtoToDto(s: IProductSuggestionProto): ProductSuggestionItemDto {
      return {
         productId: s.productId,
         productName: s.productName,
         productSlug: s.productSlug,
         whoCategoryCode: s.whoCategoryCode as never,
         origin: s.origin || undefined,
         images: s.images || [],
         defaultUnit: s.defaultUnit || undefined,
         minPrice: s.minPrice || undefined,
         maxPrice: s.maxPrice || undefined,
         currency: (s.currency as CurrencyType) || undefined,
      };
   }

   async createProduct(dto: CreateProductDto, options?: ProductCallOptions): Promise<ProductItemDto> {
      try {
         const accountId = options?.accountId;
         const metadata = createGrpcMetadata({
            correlationId: options?.correlationId,
            callerService: SERVICE_NAMES.GATEWAY,
            userId: accountId,
            accountId,
            roles: options?.roles,
            permissions: options?.permissions,
            email: options?.email,
         });

         return await this.productGrpcBreaker.execute(async () => {
            const request: ICreateProductRequest = {
               supplierId: dto.supplierId,
               whoCategoryCode: dto.whoCategoryCode,
               productName: dto.productName,
               description: dto.description,
               origin: dto.origin,
               storageCondition: dto.storageCondition,
               shelfLifeDays: dto.shelfLifeDays,
               images: dto.images || [],
               variants: dto.variants.map((v) => ({
                  sku: v.sku,
                  variantName: v.variantName,
                  unit: v.unit,
                  packSize: v.packSize,
                  price: v.price,
                  originalPrice: v.originalPrice,
                  currency: v.currency || 'VND',
                  stockQuantity: v.stockQuantity,
                  lowStockThreshold: v.lowStockThreshold,
                  isDefault: v.isDefault,
               })),
            };

            const res = await firstValueFrom(
               defer(() => this.productGrpcService.createProduct(request, metadata)).pipe(
                  withGrpcRetry(this.productGrpcRetryPolicy),
               ),
            );

            return this.mapProtoToDto(res.product);
         });
      } catch (error: unknown) {
         return handleGrpcError(error);
      }
   }

   async getProductById(productId: string, options?: ProductCallOptions): Promise<ProductItemDto> {
      try {
         const metadata = createGrpcMetadata({
            correlationId: options?.correlationId,
            callerService: SERVICE_NAMES.GATEWAY,
            userId: options?.accountId,
            accountId: options?.accountId,
            roles: options?.roles,
            permissions: options?.permissions,
            email: options?.email,
         });

         return await this.productGrpcBreaker.execute(async () => {
            const request: IGetProductByIdRequest = { productId };
            const res = await firstValueFrom(
               defer(() => this.productGrpcService.getProductById(request, metadata)).pipe(
                  withGrpcRetry(this.productGrpcRetryPolicy),
               ),
            );

            if (!res.product) {
               throw new NotFoundException(PRODUCT_ERROR_CODES.PRODUCT_NOT_FOUND, {
                  params: { productId },
               });
            }

            return this.mapProtoToDto(res.product);
         });
      } catch (error: unknown) {
         return handleGrpcError(error);
      }
   }

   async listProducts(query: ListProductsQueryDto, options?: ProductCallOptions): Promise<ListProductsResponseDto> {
      try {
         const metadata = createGrpcMetadata({
            correlationId: options?.correlationId,
            callerService: SERVICE_NAMES.GATEWAY,
            userId: options?.accountId,
            accountId: options?.accountId,
            roles: options?.roles,
            permissions: options?.permissions,
            email: options?.email,
         });

         return await this.productGrpcBreaker.execute(async () => {
            const request: IListProductsRequest = {
               supplierId: query.supplierId,
               whoCategoryCode: query.whoCategoryCode,
               status: query.status,
               moderationStatus: query.moderationStatus,
               search: query.search,
               limit: query.limit,
               offset: query.offset,
            };

            const res = await firstValueFrom(
               defer(() => this.productGrpcService.listProducts(request, metadata)).pipe(
                  withGrpcRetry(this.productGrpcRetryPolicy),
               ),
            );

            return {
               items: (res.items || []).map((item) => this.mapProtoToDto(item)),
               total: res.total,
            };
         });
      } catch (error: unknown) {
         return handleGrpcError(error);
      }
   }

   async searchProducts(
      query: SearchProductsQueryDto,
      options?: ProductCallOptions,
   ): Promise<SearchProductsResponseDto> {
      try {
         const metadata = createGrpcMetadata({
            correlationId: options?.correlationId,
            callerService: SERVICE_NAMES.GATEWAY,
            userId: options?.accountId,
            accountId: options?.accountId,
            roles: options?.roles,
            permissions: options?.permissions,
            email: options?.email,
         });

         return await this.searchGrpcBreaker.execute(async () => {
            const request: ISearchProductsRequest = {
               query: query.query,
               whoCategoryCode: query.whoCategoryCode,
               supplierId: query.supplierId,
               status: query.status,
               limit: query.limit,
               offset: query.offset,
            };

            const res = await firstValueFrom(
               defer(() => this.searchGrpcService.searchProducts(request, metadata)).pipe(
                  withGrpcRetry(this.searchGrpcRetryPolicy),
               ),
            );

            return {
               items: (res.items || []).map((item) => this.mapSearchHitProtoToDto(item)),
               total: res.total,
               limit: res.limit,
               offset: res.offset,
            };
         });
      } catch (error: unknown) {
         return handleGrpcError(error);
      }
   }

   async suggestProducts(
      query: SuggestProductsQueryDto,
      options?: ProductCallOptions,
   ): Promise<SuggestProductsResponseDto> {
      try {
         const metadata = createGrpcMetadata({
            correlationId: options?.correlationId,
            callerService: SERVICE_NAMES.GATEWAY,
            userId: options?.accountId,
            accountId: options?.accountId,
            roles: options?.roles,
            permissions: options?.permissions,
            email: options?.email,
         });

         return await this.searchGrpcBreaker.execute(async () => {
            const request: ISuggestProductsRequest = {
               query: query.query,
               limit: query.limit,
            };

            const res = await firstValueFrom(
               defer(() => this.searchGrpcService.suggestProducts(request, metadata)).pipe(
                  withGrpcRetry(this.searchGrpcRetryPolicy),
               ),
            );

            return {
               items: (res.items || []).map((item) => this.mapSuggestionProtoToDto(item)),
            };
         });
      } catch (error: unknown) {
         return handleGrpcError(error);
      }
   }

   async updateProduct(
      productId: string,
      dto: UpdateProductDto,
      options?: ProductCallOptions,
   ): Promise<ProductItemDto> {
      try {
         const accountId = options?.accountId;
         const metadata = createGrpcMetadata({
            correlationId: options?.correlationId,
            callerService: SERVICE_NAMES.GATEWAY,
            userId: accountId,
            accountId,
            roles: options?.roles,
            permissions: options?.permissions,
            email: options?.email,
         });

         return await this.productGrpcBreaker.execute(async () => {
            const request: IUpdateProductRequest = {
               productId,
               supplierId: accountId || '',
               productName: dto.productName,
               description: dto.description,
               origin: dto.origin,
               storageCondition: dto.storageCondition,
               shelfLifeDays: dto.shelfLifeDays,
               images: dto.images,
            };

            const res = await firstValueFrom(
               defer(() => this.productGrpcService.updateProduct(request, metadata)).pipe(
                  withGrpcRetry(this.productGrpcRetryPolicy),
               ),
            );

            return this.mapProtoToDto(res.product);
         });
      } catch (error: unknown) {
         return handleGrpcError(error);
      }
   }

   async moderateProduct(
      productId: string,
      dto: ModerateProductDto,
      options?: ProductCallOptions,
   ): Promise<ProductItemDto> {
      try {
         const metadata = createGrpcMetadata({
            correlationId: options?.correlationId,
            callerService: SERVICE_NAMES.GATEWAY,
            userId: options?.accountId,
            accountId: options?.accountId,
            roles: options?.roles,
            permissions: options?.permissions,
            email: options?.email,
         });

         return await this.productGrpcBreaker.execute(async () => {
            const request: IModerateProductRequest = {
               productId,
               moderationStatus: dto.moderationStatus,
               action: dto.action,
               rejectionReason: dto.rejectionReason,
               moderationNotes: dto.moderationNotes,
               moderatedBy: options?.accountId,
               moderatorEmail: options?.email,
            };

            const res = await firstValueFrom(
               defer(() => this.productGrpcService.moderateProduct(request, metadata)).pipe(
                  withGrpcRetry(this.productGrpcRetryPolicy),
               ),
            );

            return this.mapProtoToDto(res.product);
         });
      } catch (error: unknown) {
         return handleGrpcError(error);
      }
   }

   async submitProductForReview(productId: string, options?: ProductCallOptions): Promise<ProductItemDto> {
      try {
         const metadata = createGrpcMetadata({
            correlationId: options?.correlationId,
            callerService: SERVICE_NAMES.GATEWAY,
            userId: options?.accountId,
            accountId: options?.accountId,
            roles: options?.roles,
            permissions: options?.permissions,
            email: options?.email,
         });

         return await this.productGrpcBreaker.execute(async () => {
            const request: ISubmitProductForReviewRequest = {
               productId,
               supplierId: options?.accountId || '',
            };

            const res = await firstValueFrom(
               defer(() => this.productGrpcService.submitProductForReview(request, metadata)).pipe(
                  withGrpcRetry(this.productGrpcRetryPolicy),
               ),
            );

            return this.mapProtoToDto(res.product);
         });
      } catch (error: unknown) {
         return handleGrpcError(error);
      }
   }

   async getProductModerationHistory(
      productId: string,
      options?: ProductCallOptions,
   ): Promise<ProductModerationHistoryDto[]> {
      try {
         const metadata = createGrpcMetadata({
            correlationId: options?.correlationId,
            callerService: SERVICE_NAMES.GATEWAY,
            userId: options?.accountId,
            accountId: options?.accountId,
            roles: options?.roles,
            permissions: options?.permissions,
            email: options?.email,
         });

         return await this.productGrpcBreaker.execute(async () => {
            const request: IGetProductModerationHistoryRequest = {
               productId,
            };

            const res = await firstValueFrom(
               defer(() => this.productGrpcService.getProductModerationHistory(request, metadata)).pipe(
                  withGrpcRetry(this.productGrpcRetryPolicy),
               ),
            );

            return (res.items || []).map((h) => ({
               historyId: h.historyId,
               productId: h.productId,
               moderatorId: h.moderatorId,
               moderatorEmail: h.moderatorEmail || undefined,
               action: h.action as never,
               previousStatus: h.previousStatus as never,
               newStatus: h.newStatus as never,
               rejectionReason: h.rejectionReason || undefined,
               moderationNotes: h.moderationNotes || undefined,
               snapshot: h.snapshot ? (JSON.parse(h.snapshot) as Record<string, unknown>) : undefined,
               createdAt: h.createdAt,
            }));
         });
      } catch (error: unknown) {
         return handleGrpcError(error);
      }
   }

   async updateProductStatus(
      productId: string,
      dto: UpdateProductStatusDto,
      options?: ProductCallOptions,
   ): Promise<ProductItemDto> {
      try {
         const accountId = options?.accountId;
         const metadata = createGrpcMetadata({
            correlationId: options?.correlationId,
            callerService: SERVICE_NAMES.GATEWAY,
            userId: accountId,
            accountId,
            roles: options?.roles,
            permissions: options?.permissions,
            email: options?.email,
         });

         return await this.productGrpcBreaker.execute(async () => {
            const request: IUpdateProductStatusRequest = {
               productId,
               supplierId: accountId || '',
               status: dto.status,
            };

            const res = await firstValueFrom(
               defer(() => this.productGrpcService.updateProductStatus(request, metadata)).pipe(
                  withGrpcRetry(this.productGrpcRetryPolicy),
               ),
            );

            return this.mapProtoToDto(res.product);
         });
      } catch (error: unknown) {
         return handleGrpcError(error);
      }
   }

   async adjustStock(variantId: string, dto: AdjustStockDto, options?: ProductCallOptions) {
      try {
         const accountId = options?.accountId;
         const metadata = createGrpcMetadata({
            correlationId: options?.correlationId,
            callerService: SERVICE_NAMES.GATEWAY,
            userId: accountId,
            accountId,
            roles: options?.roles,
            permissions: options?.permissions,
            email: options?.email,
         });

         return await this.productGrpcBreaker.execute(async () => {
            const request: IAdjustStockRequest = {
               variantId,
               supplierId: accountId || '',
               quantityDelta: dto.quantityDelta,
               movementType: dto.movementType,
               reason: dto.reason,
            };

            const res = await firstValueFrom(
               defer(() => this.productGrpcService.adjustStock(request, metadata)).pipe(
                  withGrpcRetry(this.productGrpcRetryPolicy),
               ),
            );

            return res.variant;
         });
      } catch (error: unknown) {
         return handleGrpcError(error);
      }
   }

   async checkAndReserveStock(
      dto: CheckAndReserveStockDto,
      options?: ProductCallOptions,
   ): Promise<CheckAndReserveStockResponseDto> {
      try {
         const metadata = createGrpcMetadata({
            correlationId: options?.correlationId,
            callerService: SERVICE_NAMES.GATEWAY,
            userId: options?.accountId,
            accountId: options?.accountId,
            roles: options?.roles,
            permissions: options?.permissions,
            email: options?.email,
         });

         return await this.productGrpcBreaker.execute(async () => {
            const request: ICheckAndReserveStockRequest = {
               orderId: dto.orderId,
               items: dto.items,
            };

            const res = await firstValueFrom(
               defer(() => this.productGrpcService.checkAndReserveStock(request, metadata)).pipe(
                  withGrpcRetry(this.productGrpcRetryPolicy),
               ),
            );

            return {
               allReserved: res.allReserved,
               results: res.results.map((r) => ({
                  variantId: r.variantId,
                  sku: r.sku,
                  success: r.success,
                  availableStock: r.availableStock,
                  message: r.message,
               })),
            };
         });
      } catch (error: unknown) {
         return handleGrpcError(error);
      }
   }

   async releaseStock(dto: ReleaseStockDto, options?: ProductCallOptions): Promise<{ success: boolean }> {
      try {
         const metadata = createGrpcMetadata({
            correlationId: options?.correlationId,
            callerService: SERVICE_NAMES.GATEWAY,
            userId: options?.accountId,
            accountId: options?.accountId,
            roles: options?.roles,
            permissions: options?.permissions,
            email: options?.email,
         });

         return await this.productGrpcBreaker.execute(async () => {
            const request: IReleaseStockRequest = {
               orderId: dto.orderId,
               items: dto.items,
            };

            const res = await firstValueFrom(
               defer(() => this.productGrpcService.releaseStock(request, metadata)).pipe(
                  withGrpcRetry(this.productGrpcRetryPolicy),
               ),
            );

            return { success: res.success };
         });
      } catch (error: unknown) {
         return handleGrpcError(error);
      }
   }

   async listWhoCategories(options?: ProductCallOptions): Promise<WhoCategoryDto[]> {
      const cacheKey = PRODUCT_CACHE_KEYS.WHO_CATEGORIES_ALL;
      if (this.cacheService) {
         try {
            const cached = await this.cacheService.get<WhoCategoryDto[]>(CacheNamespace.GATEWAY, cacheKey);
            if (cached && Array.isArray(cached) && cached.length > 0) {
               return cached;
            }
         } catch {
            // Degrade gracefully if cache is unreachable
         }
      }

      try {
         const metadata = createGrpcMetadata({
            correlationId: options?.correlationId,
            callerService: SERVICE_NAMES.GATEWAY,
            userId: options?.accountId,
            accountId: options?.accountId,
            roles: options?.roles,
            permissions: options?.permissions,
            email: options?.email,
         });

         const categories = await this.productGrpcBreaker.execute(async () => {
            const res = await firstValueFrom(
               defer(() => this.productGrpcService.listWhoCategories({}, metadata)).pipe(
                  withGrpcRetry(this.productGrpcRetryPolicy),
               ),
            );

            return (res.categories || []).map((c) => ({
               code: c.code as never,
               name: c.name,
               description: c.description,
               examples: c.examples,
               order: c.order,
            }));
         });

         if (this.cacheService && categories.length > 0) {
            try {
               await this.cacheService.set(
                  CacheNamespace.GATEWAY,
                  cacheKey,
                  categories,
                  PRODUCT_CACHE_TTL.WHO_CATEGORIES_SECONDS,
               );
            } catch {
               // Degrade gracefully on cache write failure
            }
         }

         return categories;
      } catch (error: unknown) {
         return handleGrpcError(error);
      }
   }
}
