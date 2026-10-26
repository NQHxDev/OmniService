import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { defer, firstValueFrom } from 'rxjs';
import {
   BulkheadRegistry,
   CircuitBreakerRegistry,
   createGrpcMetadata,
   handleGrpcError,
   type JwtPayload,
   RetryPolicyRegistry,
   SERVICE_NAMES,
   withGrpcRetry,
} from '@common';
import { SEARCH_V1_GRPC_CLIENT, SEARCH_V1_GRPC_SERVICE_NAME, type ISearchV1GrpcService } from '@contracts/search';
import {
   COMMERCE_V1_GRPC_CLIENT,
   COMMERCE_V1_GRPC_SERVICE_NAME,
   type CategoryItemDto,
   type CreateIngredientDto,
   type CreateProductOfferDto,
   type ICommerceV1GrpcService,
   type IngredientItemDto,
   type IngredientSuppliersResponseDto,
   type SearchIngredientsDto,
   type SearchIngredientsResponseDto,
   type SupplierProductOfferDto,
} from '@contracts/commerce';
import type { IHealthCheckResponse, IHealthGrpcService } from '@contracts/health';
import { HEALTH_GRPC_SERVICE_NAME } from '@contracts/health';
import type { ISupplierProto, SupplierItemDto, SupplierStatusType } from '@contracts/supplier';

@Injectable()
export class CommerceService implements OnModuleInit {
   private readonly logger = new Logger(CommerceService.name);
   private commerceGrpcService!: ICommerceV1GrpcService;
   private searchGrpcService!: ISearchV1GrpcService;
   private readonly commerceBulkhead = BulkheadRegistry.getOrCreate(COMMERCE_V1_GRPC_SERVICE_NAME, {
      maxConcurrent: 50,
      maxQueueCapacity: 100,
   });
   private readonly searchBulkhead = BulkheadRegistry.getOrCreate(SEARCH_V1_GRPC_SERVICE_NAME, {
      maxConcurrent: 50,
      maxQueueCapacity: 100,
   });
   private readonly commerceGrpcBreaker = CircuitBreakerRegistry.getOrCreate(COMMERCE_V1_GRPC_SERVICE_NAME, {
      timeout: 3000,
      failureThreshold: 5,
      resetTimeout: 10000,
   });
   private readonly commerceGrpcRetryPolicy = RetryPolicyRegistry.getOrCreate(COMMERCE_V1_GRPC_SERVICE_NAME, {
      maxAttempts: 3,
      initialDelayMs: 100,
      multiplier: 2,
      maxDelayMs: 2000,
   });
   private readonly searchGrpcBreaker = CircuitBreakerRegistry.getOrCreate(SEARCH_V1_GRPC_SERVICE_NAME, {
      timeout: 5000,
      failureThreshold: 5,
      resetTimeout: 10000,
   });
   private readonly searchGrpcRetryPolicy = RetryPolicyRegistry.getOrCreate(SEARCH_V1_GRPC_SERVICE_NAME, {
      maxAttempts: 3,
      initialDelayMs: 100,
      multiplier: 2,
      maxDelayMs: 2000,
   });

   constructor(
      @Inject(COMMERCE_V1_GRPC_CLIENT) private readonly commerceGrpcClient: ClientGrpc,
      @Inject(SEARCH_V1_GRPC_CLIENT) private readonly searchGrpcClient: ClientGrpc,
   ) {}

   onModuleInit(): void {
      this.commerceGrpcService =
         this.commerceGrpcClient.getService<ICommerceV1GrpcService>(COMMERCE_V1_GRPC_SERVICE_NAME);
      this.searchGrpcService = this.searchGrpcClient.getService<ISearchV1GrpcService>(SEARCH_V1_GRPC_SERVICE_NAME);
   }

   private mapProtoToSupplierDto(supp: ISupplierProto): SupplierItemDto {
      return {
         supplierId: supp.supplierId,
         supplierName: supp.supplierName,
         supplierSlug: supp.supplierSlug,
         supplierCode: supp.supplierCode,
         contactEmail: supp.contactEmail || undefined,
         contactPhone: supp.contactPhone || undefined,
         address: supp.address || undefined,
         city: supp.city || undefined,
         rating: supp.rating,
         isVerified: supp.isVerified,
         supplierStatus: supp.supplierStatus as SupplierStatusType,
         supplierLogoUrl: supp.supplierLogoUrl || undefined,
      };
   }

   async searchIngredients(dto: SearchIngredientsDto): Promise<SearchIngredientsResponseDto> {
      try {
         const res = await this.searchBulkhead.execute(
            () =>
               this.searchGrpcBreaker.execute(
                  () =>
                     firstValueFrom(
                        defer(() =>
                           this.searchGrpcService.searchIngredients({
                              query: dto.query,
                              categoryId: dto.categoryId,
                              limit: dto.limit,
                              offset: dto.offset,
                           }),
                        ).pipe(withGrpcRetry(this.searchGrpcRetryPolicy)),
                     ),
                  (err) => {
                     this.logger.warn(`Search ingredients degraded fallback triggered: ${err.message}`);
                     return {
                        items: [],
                        total: 0,
                        limit: dto.limit ?? 20,
                        offset: dto.offset ?? 0,
                     };
                  },
               ),
            (err) => {
               this.logger.warn(`Search ingredients bulkhead overflow fallback triggered: ${err.message}`);
               return {
                  items: [],
                  total: 0,
                  limit: dto.limit ?? 20,
                  offset: dto.offset ?? 0,
               };
            },
         );

         return {
            items: (res?.items ?? []).map((i) => ({
               ingredientId: i.ingredientId,
               ingredientName: i.ingredientName,
               normalizedName: i.normalizedName,
               ingredientSlug: i.ingredientSlug,
               ingredientDescription: i.ingredientDescription,
               ingredientImageUrl: i.ingredientImageUrl,
               categoryId: i.categoryId,
               categoryName: i.categoryName,
               defaultUnit: i.defaultUnit,
               ingredientStatus: i.ingredientStatus,
               supplierCount: i.supplierCount ?? 0,
               minPrice: i.minPrice ?? 0,
               maxPrice: i.maxPrice ?? 0,
               currency: i.currency,
            })),
            total: res?.total ?? 0,
            limit: res?.limit ?? dto.limit ?? 20,
            offset: res?.offset ?? dto.offset ?? 0,
         };
      } catch (error: unknown) {
         return handleGrpcError(error);
      }
   }

   async getIngredientById(
      ingredientId: string,
      correlationId?: string,
   ): Promise<{ ingredient: IngredientItemDto; offers: SupplierProductOfferDto[] }> {
      try {
         const metadata = createGrpcMetadata({
            correlationId,
            callerService: SERVICE_NAMES.GATEWAY,
         });

         return await this.commerceGrpcBreaker.execute(async () => {
            const res = await firstValueFrom(
               defer(() => this.commerceGrpcService.getIngredientById({ ingredientId }, metadata)).pipe(
                  withGrpcRetry(this.commerceGrpcRetryPolicy),
               ),
            );

            const ing = res.ingredient!;
            return {
               ingredient: {
                  ingredientId: ing.ingredientId,
                  ingredientName: ing.ingredientName,
                  normalizedName: ing.normalizedName,
                  ingredientSlug: ing.ingredientSlug,
                  ingredientDescription: ing.ingredientDescription,
                  ingredientImageUrl: ing.ingredientImageUrl,
                  categoryId: ing.categoryId,
                  categoryName: ing.categoryName,
                  defaultUnit: ing.defaultUnit,
                  ingredientStatus: ing.ingredientStatus,
                  supplierCount: ing.supplierCount,
                  minPrice: ing.minPrice,
                  maxPrice: ing.maxPrice,
                  currency: ing.currency,
               },
               offers: res.offers.map((offer) => ({
                  productId: offer.productId,
                  supplierId: offer.supplierId,
                  ingredientId: offer.ingredientId,
                  productSku: offer.productSku,
                  productTitle: offer.productTitle,
                  price: offer.price,
                  currency: offer.currency,
                  originalPrice: offer.originalPrice || undefined,
                  packageSize: offer.packageSize || undefined,
                  stockQuantity: offer.stockQuantity,
                  inStock: offer.inStock,
                  productUrl: offer.productUrl || undefined,
                  productImageUrl: offer.productImageUrl || undefined,
                  offerStatus: offer.offerStatus,
                  supplier: offer.supplier ? this.mapProtoToSupplierDto(offer.supplier) : undefined,
               })),
            };
         });
      } catch (error: unknown) {
         return handleGrpcError(error);
      }
   }

   async getSuppliersByIngredient(
      ingredientId: string,
      inStockOnly: boolean = false,
      correlationId?: string,
   ): Promise<IngredientSuppliersResponseDto> {
      try {
         const metadata = createGrpcMetadata({
            correlationId,
            callerService: SERVICE_NAMES.GATEWAY,
         });

         return await this.commerceBulkhead.execute(
            () =>
               this.commerceGrpcBreaker.execute(
                  async () => {
                     const res = await firstValueFrom(
                        defer(() =>
                           this.commerceGrpcService.getSuppliersByIngredient({ ingredientId, inStockOnly }, metadata),
                        ).pipe(withGrpcRetry(this.commerceGrpcRetryPolicy)),
                     );

                     return {
                        ingredientId: res.ingredientId,
                        ingredientName: res.ingredientName,
                        offers: res.offers.map((offer) => ({
                           productId: offer.productId,
                           supplierId: offer.supplierId,
                           ingredientId: offer.ingredientId,
                           productSku: offer.productSku,
                           productTitle: offer.productTitle,
                           price: offer.price,
                           currency: offer.currency,
                           originalPrice: offer.originalPrice || undefined,
                           packageSize: offer.packageSize || undefined,
                           stockQuantity: offer.stockQuantity,
                           inStock: offer.inStock,
                           productUrl: offer.productUrl || undefined,
                           productImageUrl: offer.productImageUrl || undefined,
                           offerStatus: offer.offerStatus,
                           supplier: offer.supplier ? this.mapProtoToSupplierDto(offer.supplier) : undefined,
                        })),
                        totalOffers: res.totalOffers,
                     };
                  },
                  (err) => {
                     this.logger.warn(
                        `getSuppliersByIngredient fallback triggered for ${ingredientId}: ${err.message}`,
                     );
                     return {
                        ingredientId,
                        ingredientName: '',
                        offers: [],
                        totalOffers: 0,
                     };
                  },
               ),
            (err) => {
               this.logger.warn(`getSuppliersByIngredient bulkhead fallback for ${ingredientId}: ${err.message}`);
               return {
                  ingredientId,
                  ingredientName: '',
                  offers: [],
                  totalOffers: 0,
               };
            },
         );
      } catch (error: unknown) {
         return handleGrpcError(error);
      }
   }

   async listCategories(correlationId?: string): Promise<CategoryItemDto[]> {
      try {
         const metadata = createGrpcMetadata({
            correlationId,
            callerService: SERVICE_NAMES.GATEWAY,
         });

         return await this.commerceBulkhead.execute(
            () =>
               this.commerceGrpcBreaker.execute(
                  async () => {
                     const res = await firstValueFrom(
                        defer(() => this.commerceGrpcService.listCategories({}, metadata)).pipe(
                           withGrpcRetry(this.commerceGrpcRetryPolicy),
                        ),
                     );

                     return res.categories.map((c) => ({
                        categoryId: c.categoryId,
                        categoryName: c.categoryName,
                        categorySlug: c.categorySlug,
                        iconUrl: c.iconUrl || undefined,
                     }));
                  },
                  (err) => {
                     this.logger.warn(`listCategories fallback triggered: ${err.message}`);
                     return [];
                  },
               ),
            (err) => {
               this.logger.warn(`listCategories bulkhead fallback triggered: ${err.message}`);
               return [];
            },
         );
      } catch (error: unknown) {
         return handleGrpcError(error);
      }
   }

   async createIngredient(
      dto: CreateIngredientDto,
      options?: { correlationId?: string; user?: JwtPayload },
   ): Promise<IngredientItemDto> {
      try {
         const metadata = createGrpcMetadata({
            correlationId: options?.correlationId,
            callerService: SERVICE_NAMES.GATEWAY,
            user: options?.user
               ? {
                    userId: options.user.sub,
                    accountId: options.user.sub,
                    roles: options.user.roles,
                    email: options.user.email,
                 }
               : undefined,
         });

         return await this.commerceGrpcBreaker.execute(async () => {
            const res = await firstValueFrom(
               defer(() =>
                  this.commerceGrpcService.createIngredient(
                     {
                        ingredientName: dto.ingredientName,
                        ingredientDescription: dto.ingredientDescription,
                        categoryId: dto.categoryId,
                        defaultUnit: dto.defaultUnit,
                        ingredientImageUrl: dto.ingredientImageUrl,
                     },
                     metadata,
                  ),
               ).pipe(withGrpcRetry(this.commerceGrpcRetryPolicy)),
            );

            const ing = res.ingredient;
            return {
               ingredientId: ing.ingredientId,
               ingredientName: ing.ingredientName,
               normalizedName: ing.normalizedName,
               ingredientSlug: ing.ingredientSlug,
               ingredientDescription: ing.ingredientDescription,
               ingredientImageUrl: ing.ingredientImageUrl,
               categoryId: ing.categoryId,
               categoryName: ing.categoryName,
               defaultUnit: ing.defaultUnit,
               ingredientStatus: ing.ingredientStatus,
               supplierCount: ing.supplierCount,
               minPrice: ing.minPrice,
               maxPrice: ing.maxPrice,
               currency: ing.currency,
            };
         });
      } catch (error: unknown) {
         return handleGrpcError(error);
      }
   }

   async createProductOffer(
      dto: CreateProductOfferDto,
      options?: { correlationId?: string; user?: JwtPayload },
   ): Promise<SupplierProductOfferDto> {
      try {
         const metadata = createGrpcMetadata({
            correlationId: options?.correlationId,
            callerService: SERVICE_NAMES.GATEWAY,
            user: options?.user
               ? {
                    userId: options.user.sub,
                    accountId: options.user.sub,
                    roles: options.user.roles,
                    email: options.user.email,
                 }
               : undefined,
         });

         return await this.commerceGrpcBreaker.execute(async () => {
            const res = await firstValueFrom(
               defer(() =>
                  this.commerceGrpcService.createSupplierProduct(
                     {
                        supplierId: dto.supplierId,
                        ingredientId: dto.ingredientId,
                        productSku: dto.productSku,
                        productTitle: dto.productTitle,
                        price: dto.price,
                        currency: dto.currency,
                        originalPrice: dto.originalPrice,
                        packageSize: dto.packageSize,
                        stockQuantity: dto.stockQuantity,
                        productUrl: dto.productUrl,
                        productImageUrl: dto.productImageUrl,
                     },
                     metadata,
                  ),
               ).pipe(withGrpcRetry(this.commerceGrpcRetryPolicy)),
            );

            const offer = res.product;
            return {
               productId: offer.productId,
               supplierId: offer.supplierId,
               ingredientId: offer.ingredientId,
               productSku: offer.productSku,
               productTitle: offer.productTitle,
               price: offer.price,
               currency: offer.currency,
               originalPrice: offer.originalPrice || undefined,
               packageSize: offer.packageSize || undefined,
               stockQuantity: offer.stockQuantity,
               inStock: offer.inStock,
               productUrl: offer.productUrl || undefined,
               productImageUrl: offer.productImageUrl || undefined,
               offerStatus: offer.offerStatus,
               supplier: offer.supplier ? this.mapProtoToSupplierDto(offer.supplier) : undefined,
            };
         });
      } catch (error: unknown) {
         return handleGrpcError(error);
      }
   }

   async checkGrpcHealth(): Promise<IHealthCheckResponse> {
      try {
         const healthService = this.commerceGrpcClient.getService<IHealthGrpcService>(HEALTH_GRPC_SERVICE_NAME);
         return await firstValueFrom(healthService.check({ service: COMMERCE_V1_GRPC_SERVICE_NAME }));
      } catch (error) {
         return handleGrpcError(error);
      }
   }
}
