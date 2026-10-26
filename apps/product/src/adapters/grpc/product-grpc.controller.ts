import { Controller, UseFilters, UseInterceptors } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import type { Metadata } from '@grpc/grpc-js';
import { from, type Observable } from 'rxjs';
import {
   checkRoles,
   COMMON_ERROR_CODES,
   CommandBus,
   DEFAULT_ROLES,
   extractGrpcUser,
   GrpcExceptionFilter,
   GrpcLoggingInterceptor,
   GrpcMetricsInterceptor,
   UnauthorizedException,
} from '@common';
import {
   PRODUCT_V1_GRPC_METHODS,
   PRODUCT_V1_GRPC_SERVICE_NAME,
   type IAdjustStockRequest,
   type IAdjustStockResponse,
   type ICheckAndReserveStockRequest,
   type ICheckAndReserveStockResponse,
   type ICreateProductRequest,
   type ICreateProductResponse,
   type IGetProductByIdRequest,
   type IGetProductByIdResponse,
   type IGetProductsByIdsRequest,
   type IGetProductsByIdsResponse,
   type IListProductsRequest,
   type IListProductsResponse,
   type IListWhoCategoriesRequest,
   type IListWhoCategoriesResponse,
   type IModerateProductRequest,
   type IModerateProductResponse,
   type IProductProto,
   type IProductV1GrpcService,
   type IReleaseStockRequest,
   type IReleaseStockResponse,
   type IUpdateProductRequest,
   type IUpdateProductResponse,
   type IUpdateProductStatusRequest,
   type IUpdateProductStatusResponse,
   type ProductItemDto,
} from '@contracts/product';
import {
   AdjustStockCommand,
   CheckAndReserveStockCommand,
   CreateProductCommand,
   GetProductByIdQuery,
   GetProductsByIdsQuery,
   ListProductsQuery,
   ListWhoCategoriesQuery,
   ModerateProductCommand,
   ReleaseStockCommand,
   UpdateProductCommand,
   UpdateProductStatusCommand,
} from '@product/commands';

@Controller()
@UseFilters(new GrpcExceptionFilter())
@UseInterceptors(GrpcLoggingInterceptor, GrpcMetricsInterceptor)
export class ProductGrpcController implements IProductV1GrpcService {
   constructor(private readonly commandBus: CommandBus) {}

   private extractAccountId(metadata?: Metadata, fallbackId?: string): string {
      const user = extractGrpcUser(metadata);
      const resolved = user?.userId || fallbackId;
      if (!resolved) {
         throw new UnauthorizedException(COMMON_ERROR_CODES.UNAUTHORIZED);
      }
      return resolved;
   }

   private mapProductToProto(product: ProductItemDto): IProductProto {
      return {
         productId: product.productId,
         supplierId: product.supplierId,
         whoCategoryCode: product.whoCategoryCode,
         productName: product.productName,
         productSlug: product.productSlug,
         description: product.description,
         origin: product.origin || '',
         storageCondition: product.storageCondition || '',
         shelfLifeDays: product.shelfLifeDays || 0,
         images: product.images || [],
         status: product.status,
         moderationStatus: product.moderationStatus,
         rejectionReason: product.rejectionReason || '',
         variants: (product.variants || []).map((v) => ({
            variantId: v.variantId,
            productId: v.productId,
            sku: v.sku,
            variantName: v.variantName,
            unit: v.unit,
            packSize: v.packSize || '',
            price: v.price,
            originalPrice: v.originalPrice || 0,
            currency: v.currency,
            stockQuantity: v.stockQuantity,
            reservedQuantity: v.reservedQuantity,
            lowStockThreshold: v.lowStockThreshold,
            isDefault: v.isDefault,
            status: v.status,
         })),
         version: product.version,
         createdAt: product.createdAt,
         updatedAt: product.updatedAt,
      };
   }

   @GrpcMethod(PRODUCT_V1_GRPC_SERVICE_NAME, PRODUCT_V1_GRPC_METHODS.GET_PRODUCT_BY_ID)
   getProductById(data: IGetProductByIdRequest): Observable<IGetProductByIdResponse> {
      return from(
         this.commandBus.execute(new GetProductByIdQuery(data.productId)).then((product) => ({
            product: this.mapProductToProto(product),
         })),
      );
   }

   @GrpcMethod(PRODUCT_V1_GRPC_SERVICE_NAME, PRODUCT_V1_GRPC_METHODS.GET_PRODUCTS_BY_IDS)
   getProductsByIds(data: IGetProductsByIdsRequest): Observable<IGetProductsByIdsResponse> {
      return from(
         this.commandBus.execute(new GetProductsByIdsQuery(data.productIds)).then((products) => ({
            products: products.map((p) => this.mapProductToProto(p)),
         })),
      );
   }

   @GrpcMethod(PRODUCT_V1_GRPC_SERVICE_NAME, PRODUCT_V1_GRPC_METHODS.LIST_PRODUCTS)
   listProducts(data: IListProductsRequest): Observable<IListProductsResponse> {
      return from(
         this.commandBus
            .execute(
               new ListProductsQuery({
                  supplierId: data.supplierId,
                  whoCategoryCode: data.whoCategoryCode as never,
                  status: data.status as never,
                  moderationStatus: data.moderationStatus as never,
                  search: data.search,
                  limit: data.limit,
                  offset: data.offset,
               }),
            )
            .then((result) => ({
               items: result.items.map((p) => this.mapProductToProto(p)),
               total: result.total,
            })),
      );
   }

   @GrpcMethod(PRODUCT_V1_GRPC_SERVICE_NAME, PRODUCT_V1_GRPC_METHODS.CREATE_PRODUCT)
   createProduct(data: ICreateProductRequest, metadata?: Metadata): Observable<ICreateProductResponse> {
      const supplierId = this.extractAccountId(metadata, data.supplierId);

      return from(
         this.commandBus
            .execute(
               new CreateProductCommand(supplierId, {
                  whoCategoryCode: data.whoCategoryCode as never,
                  productName: data.productName,
                  description: data.description,
                  origin: data.origin,
                  storageCondition: data.storageCondition,
                  shelfLifeDays: data.shelfLifeDays,
                  images: data.images,
                  variants: data.variants.map((v) => ({
                     sku: v.sku,
                     variantName: v.variantName,
                     unit: v.unit,
                     packSize: v.packSize,
                     price: v.price,
                     originalPrice: v.originalPrice,
                     currency: (v.currency as never) || 'VND',
                     stockQuantity: v.stockQuantity,
                     lowStockThreshold: v.lowStockThreshold,
                     isDefault: v.isDefault,
                  })),
               }),
            )
            .then((product) => ({
               product: this.mapProductToProto(product),
            })),
      );
   }

   @GrpcMethod(PRODUCT_V1_GRPC_SERVICE_NAME, PRODUCT_V1_GRPC_METHODS.UPDATE_PRODUCT)
   updateProduct(data: IUpdateProductRequest, metadata?: Metadata): Observable<IUpdateProductResponse> {
      const supplierId = this.extractAccountId(metadata, data.supplierId);

      return from(
         this.commandBus
            .execute(
               new UpdateProductCommand(data.productId, supplierId, {
                  productName: data.productName,
                  description: data.description,
                  origin: data.origin,
                  storageCondition: data.storageCondition,
                  shelfLifeDays: data.shelfLifeDays,
                  images: data.images,
               }),
            )
            .then((product) => ({
               product: this.mapProductToProto(product),
            })),
      );
   }

   @GrpcMethod(PRODUCT_V1_GRPC_SERVICE_NAME, PRODUCT_V1_GRPC_METHODS.MODERATE_PRODUCT)
   moderateProduct(data: IModerateProductRequest, metadata?: Metadata): Observable<IModerateProductResponse> {
      checkRoles(metadata, [DEFAULT_ROLES.ADMIN]);
      const moderatorId = this.extractAccountId(metadata, data.moderatedBy);

      return from(
         this.commandBus
            .execute(
               new ModerateProductCommand(data.productId, moderatorId, {
                  moderationStatus: data.moderationStatus as never,
                  rejectionReason: data.rejectionReason,
               }),
            )
            .then((product) => ({
               product: this.mapProductToProto(product),
            })),
      );
   }

   @GrpcMethod(PRODUCT_V1_GRPC_SERVICE_NAME, PRODUCT_V1_GRPC_METHODS.UPDATE_PRODUCT_STATUS)
   updateProductStatus(
      data: IUpdateProductStatusRequest,
      metadata?: Metadata,
   ): Observable<IUpdateProductStatusResponse> {
      const supplierId = this.extractAccountId(metadata, data.supplierId);

      return from(
         this.commandBus
            .execute(
               new UpdateProductStatusCommand(data.productId, supplierId, {
                  status: data.status as never,
               }),
            )
            .then((product) => ({
               product: this.mapProductToProto(product),
            })),
      );
   }

   @GrpcMethod(PRODUCT_V1_GRPC_SERVICE_NAME, PRODUCT_V1_GRPC_METHODS.CHECK_AND_RESERVE_STOCK)
   checkAndReserveStock(data: ICheckAndReserveStockRequest): Observable<ICheckAndReserveStockResponse> {
      return from(
         this.commandBus
            .execute(
               new CheckAndReserveStockCommand({
                  orderId: data.orderId,
                  items: data.items,
               }),
            )
            .then((res) => ({
               allReserved: res.allReserved,
               results: res.results.map((r) => ({
                  variantId: r.variantId,
                  sku: r.sku,
                  success: r.success,
                  availableStock: r.availableStock,
                  message: r.message || '',
               })),
            })),
      );
   }

   @GrpcMethod(PRODUCT_V1_GRPC_SERVICE_NAME, PRODUCT_V1_GRPC_METHODS.RELEASE_STOCK)
   releaseStock(data: IReleaseStockRequest): Observable<IReleaseStockResponse> {
      return from(
         this.commandBus
            .execute(
               new ReleaseStockCommand({
                  orderId: data.orderId,
                  items: data.items,
               }),
            )
            .then((res) => ({
               success: res.success,
            })),
      );
   }

   @GrpcMethod(PRODUCT_V1_GRPC_SERVICE_NAME, PRODUCT_V1_GRPC_METHODS.ADJUST_STOCK)
   adjustStock(data: IAdjustStockRequest): Observable<IAdjustStockResponse> {
      return from(
         this.commandBus
            .execute(
               new AdjustStockCommand(data.variantId, {
                  quantityDelta: data.quantityDelta,
                  movementType: data.movementType as never,
                  reason: data.reason,
               }),
            )
            .then((res) => ({
               variant: {
                  variantId: res.variantId,
                  productId: '',
                  sku: '',
                  variantName: '',
                  unit: '',
                  price: 0,
                  currency: 'VND',
                  stockQuantity: res.newStockQuantity,
                  reservedQuantity: 0,
                  lowStockThreshold: 0,
                  isDefault: false,
                  status: '',
               },
            })),
      );
   }

   @GrpcMethod(PRODUCT_V1_GRPC_SERVICE_NAME, PRODUCT_V1_GRPC_METHODS.LIST_WHO_CATEGORIES)
   listWhoCategories(_data: IListWhoCategoriesRequest): Observable<IListWhoCategoriesResponse> {
      return from(
         this.commandBus.execute(new ListWhoCategoriesQuery()).then((categories) => ({
            categories: categories.map((c) => ({
               code: c.code,
               name: c.name,
               description: c.description || '',
               examples: c.examples || '',
               order: c.order,
            })),
         })),
      );
   }
}
