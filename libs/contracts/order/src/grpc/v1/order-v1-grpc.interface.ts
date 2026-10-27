import type { Observable } from 'rxjs';
import type { Metadata } from '@grpc/grpc-js';

export interface IOrderItemProto {
   orderItemId: string;
   orderId: string;
   productId: string;
   productName: string;
   quantity: number;
   unitPrice: number;
   totalPrice: number;
   imageUrl?: string;
}

export interface IOrderProto {
   orderId: string;
   userId: string;
   orderNumber: string;
   orderStatus: string;
   paymentMethod: string;
   paymentStatus: string;
   totalAmount: number;
   shippingFee: number;
   shippingAddress: string;
   receiverName: string;
   receiverPhone: string;
   note?: string;
   items: IOrderItemProto[];
   createdAt: string;
   updatedAt: string;
   supplierId?: string;
   shippingMethod?: string;
   shipperTrackingCode?: string;
}

export interface ICreateOrderItemInput {
   productId: string;
   productName: string;
   quantity: number;
   unitPrice: number;
   imageUrl?: string;
}

export interface ICreateOrderRequest {
   userId: string;
   paymentMethod: string;
   shippingAddress: string;
   receiverName: string;
   receiverPhone: string;
   note?: string;
   shippingFee?: number;
   items: ICreateOrderItemInput[];
   supplierId?: string;
   shippingMethod?: string;
}

export interface ICreateOrderResponse {
   order: IOrderProto;
}

export interface IGetOrderByIdRequest {
   orderId: string;
   userId: string;
}

export interface IGetOrderByIdResponse {
   order: IOrderProto;
}

export interface IGetOrdersByUserIdRequest {
   userId: string;
   page?: number;
   limit?: number;
}

export interface IGetOrdersByUserIdResponse {
   orders: IOrderProto[];
   total: number;
   page: number;
   limit: number;
}

export interface ICancelOrderRequest {
   orderId: string;
   userId: string;
   reason?: string;
}

export interface ICancelOrderResponse {
   order: IOrderProto;
}

export interface IUpdateOrderStatusRequest {
   orderId: string;
   status: string;
}

export interface IUpdateOrderStatusResponse {
   order: IOrderProto;
}

// Supplier Order Interfaces
export interface ISupplierOrderItemProto {
   orderItemId: string;
   productId: string;
   title: string;
   quantity: number;
   price: number;
   totalPrice: number;
   imageUrl?: string;
}

export interface ISupplierOrderSummaryProto {
   shippingCount: number;
   needsActionCount: number;
}

export interface ISupplierOrderPaginationProto {
   page: number;
   limit: number;
   totalItems: number;
   totalPages: number;
}

export interface ISupplierOrderListItemProto {
   orderId: string;
   orderNumber: string;
   customerName: string;
   customerPhone: string;
   deliveryAddress: string;
   shippingMethod: string;
   totalAmount: number;
   shippingFee: number;
   status: string;
   paymentMethod: string;
   paymentStatus: string;
   note?: string;
   createdAt: string;
   updatedAt: string;
   items: ISupplierOrderItemProto[];
}

export interface IListSupplierOrdersRequest {
   supplierId: string;
   page?: number;
   limit?: number;
   group?: string;
   status?: string;
   dateRange?: string;
   startDate?: string;
   endDate?: string;
   shippingMethod?: string;
   paymentStatus?: string;
   search?: string;
   sortBy?: string;
   sortOrder?: string;
}

export interface IListSupplierOrdersResponse {
   items: ISupplierOrderListItemProto[];
   pagination: ISupplierOrderPaginationProto;
   summary: ISupplierOrderSummaryProto;
}

export interface IOrderTimelineProto {
   status: string;
   time: string;
   description: string;
}

export interface ICustomerDetailProto {
   userId: string;
   name: string;
   phone: string;
   avatar?: string;
}

export interface ISupplierOrderDetailProto {
   orderId: string;
   orderNumber: string;
   customer: ICustomerDetailProto;
   shippingAddress: string;
   shippingMethod: string;
   status: string;
   paymentMethod: string;
   paymentStatus: string;
   totalAmount: number;
   subTotal: number;
   shippingFee: number;
   discountAmount: number;
   note?: string;
   items: ISupplierOrderItemProto[];
   timeline: IOrderTimelineProto[];
   createdAt: string;
   updatedAt: string;
}

export interface IGetSupplierOrderByIdRequest {
   orderId: string;
   supplierId: string;
}

export interface IGetSupplierOrderByIdResponse {
   order: ISupplierOrderDetailProto;
}

export interface IUpdateSupplierOrderStatusRequest {
   orderId: string;
   supplierId: string;
   status: string;
   reason?: string;
   shipperTrackingCode?: string;
}

export interface IUpdateSupplierOrderStatusResponse {
   orderId: string;
   status: string;
   updatedAt: string;
}

export interface IOrderV1GrpcService {
   createOrder(request: ICreateOrderRequest, metadata?: Metadata): Observable<ICreateOrderResponse>;
   getOrderById(request: IGetOrderByIdRequest, metadata?: Metadata): Observable<IGetOrderByIdResponse>;
   getOrdersByUserId(request: IGetOrdersByUserIdRequest, metadata?: Metadata): Observable<IGetOrdersByUserIdResponse>;
   cancelOrder(request: ICancelOrderRequest, metadata?: Metadata): Observable<ICancelOrderResponse>;
   updateOrderStatus(request: IUpdateOrderStatusRequest, metadata?: Metadata): Observable<IUpdateOrderStatusResponse>;

   listSupplierOrders(
      request: IListSupplierOrdersRequest,
      metadata?: Metadata,
   ): Observable<IListSupplierOrdersResponse>;
   getSupplierOrderById(
      request: IGetSupplierOrderByIdRequest,
      metadata?: Metadata,
   ): Observable<IGetSupplierOrderByIdResponse>;
   updateSupplierOrderStatus(
      request: IUpdateSupplierOrderStatusRequest,
      metadata?: Metadata,
   ): Observable<IUpdateSupplierOrderStatusResponse>;
}

export type IOrderGrpcService = IOrderV1GrpcService;
