import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { defer, firstValueFrom } from 'rxjs';
import {
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
   type IListProductsRequest,
   type IModerateProductRequest,
   type IProductProto,
   type IProductV1GrpcService,
   type IReleaseStockRequest,
   type IUpdateProductRequest,
   type IUpdateProductStatusRequest,
   type ListProductsQueryDto,
   type ListProductsResponseDto,
   type ModerateProductDto,
   type ProductItemDto,
   type ReleaseStockDto,
   type UpdateProductDto,
   type UpdateProductStatusDto,
   type WhoCategoryDto,
} from '@contracts/product';

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

   constructor(@Inject(PRODUCT_V1_GRPC_CLIENT) private readonly productGrpcClient: ClientGrpc) {}

   onModuleInit(): void {
      this.productGrpcService = this.productGrpcClient.getService<IProductV1GrpcService>(PRODUCT_V1_GRPC_SERVICE_NAME);
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
               supplierId: accountId || '',
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
               rejectionReason: dto.rejectionReason,
               moderatedBy: options?.accountId,
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
      } catch (error: unknown) {
         return handleGrpcError(error);
      }
   }
}
