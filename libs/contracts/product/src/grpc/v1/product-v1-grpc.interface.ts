import type { Observable } from 'rxjs';
import type { Metadata } from '@grpc/grpc-js';
import type {
   IAdjustStockRequest,
   IAdjustStockResponse,
   ICheckAndReserveStockRequest,
   ICheckAndReserveStockResponse,
   ICreateProductRequest,
   ICreateProductResponse,
   IGetProductByIdRequest,
   IGetProductByIdResponse,
   IGetProductsByIdsRequest,
   IGetProductsByIdsResponse,
   IListProductsRequest,
   IListProductsResponse,
   IListWhoCategoriesRequest,
   IListWhoCategoriesResponse,
   IModerateProductRequest,
   IModerateProductResponse,
   IReleaseStockRequest,
   IReleaseStockResponse,
   IUpdateProductRequest,
   IUpdateProductResponse,
   IUpdateProductStatusRequest,
   IUpdateProductStatusResponse,
} from './messages';

export interface IProductV1GrpcService {
   getProductById(data: IGetProductByIdRequest, metadata?: Metadata): Observable<IGetProductByIdResponse>;
   getProductsByIds(data: IGetProductsByIdsRequest, metadata?: Metadata): Observable<IGetProductsByIdsResponse>;
   listProducts(data: IListProductsRequest, metadata?: Metadata): Observable<IListProductsResponse>;
   createProduct(data: ICreateProductRequest, metadata?: Metadata): Observable<ICreateProductResponse>;
   updateProduct(data: IUpdateProductRequest, metadata?: Metadata): Observable<IUpdateProductResponse>;
   moderateProduct(data: IModerateProductRequest, metadata?: Metadata): Observable<IModerateProductResponse>;
   updateProductStatus(
      data: IUpdateProductStatusRequest,
      metadata?: Metadata,
   ): Observable<IUpdateProductStatusResponse>;
   checkAndReserveStock(
      data: ICheckAndReserveStockRequest,
      metadata?: Metadata,
   ): Observable<ICheckAndReserveStockResponse>;
   releaseStock(data: IReleaseStockRequest, metadata?: Metadata): Observable<IReleaseStockResponse>;
   adjustStock(data: IAdjustStockRequest, metadata?: Metadata): Observable<IAdjustStockResponse>;
   listWhoCategories(data: IListWhoCategoriesRequest, metadata?: Metadata): Observable<IListWhoCategoriesResponse>;
}
