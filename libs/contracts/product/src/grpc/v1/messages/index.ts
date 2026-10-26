import type { IProductProto, IProductVariantProto, IWhoCategoryProto } from '../models';

export interface IGetProductByIdRequest {
   productId: string;
}

export interface IGetProductByIdResponse {
   product?: IProductProto;
}

export interface IGetProductsByIdsRequest {
   productIds: string[];
}

export interface IGetProductsByIdsResponse {
   products: IProductProto[];
}

export interface IListProductsRequest {
   supplierId?: string;
   whoCategoryCode?: string;
   status?: string;
   moderationStatus?: string;
   search?: string;
   limit?: number;
   offset?: number;
}

export interface IListProductsResponse {
   items: IProductProto[];
   total: number;
}

export interface ICreateVariantInputProto {
   sku: string;
   variantName: string;
   unit: string;
   packSize?: string;
   price: number;
   originalPrice?: number;
   currency?: string;
   stockQuantity: number;
   lowStockThreshold?: number;
   isDefault?: boolean;
}

export interface ICreateProductRequest {
   supplierId: string;
   whoCategoryCode: string;
   productName: string;
   description: string;
   origin?: string;
   storageCondition?: string;
   shelfLifeDays?: number;
   images?: string[];
   variants: ICreateVariantInputProto[];
}

export interface ICreateProductResponse {
   product: IProductProto;
}

export interface IUpdateProductRequest {
   productId: string;
   supplierId: string;
   productName?: string;
   description?: string;
   origin?: string;
   storageCondition?: string;
   shelfLifeDays?: number;
   images?: string[];
}

export interface IUpdateProductResponse {
   product: IProductProto;
}

export interface IModerateProductRequest {
   productId: string;
   moderationStatus: string;
   rejectionReason?: string;
   moderatedBy?: string;
}

export interface IModerateProductResponse {
   product: IProductProto;
}

export interface IUpdateProductStatusRequest {
   productId: string;
   supplierId: string;
   status: string;
}

export interface IUpdateProductStatusResponse {
   product: IProductProto;
}

export interface IStockItemRequest {
   variantId: string;
   quantity: number;
}

export interface ICheckAndReserveStockRequest {
   orderId: string;
   items: IStockItemRequest[];
}

export interface IReservedItemResult {
   variantId: string;
   sku: string;
   success: boolean;
   availableStock: number;
   message?: string;
}

export interface ICheckAndReserveStockResponse {
   allReserved: boolean;
   results: IReservedItemResult[];
}

export interface IReleaseStockRequest {
   orderId: string;
   items: IStockItemRequest[];
}

export interface IReleaseStockResponse {
   success: boolean;
}

export interface IAdjustStockRequest {
   variantId: string;
   supplierId: string;
   quantityDelta: number;
   movementType: string;
   reason?: string;
}

export interface IAdjustStockResponse {
   variant: IProductVariantProto;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface IListWhoCategoriesRequest {}

export interface IListWhoCategoriesResponse {
   categories: IWhoCategoryProto[];
}
