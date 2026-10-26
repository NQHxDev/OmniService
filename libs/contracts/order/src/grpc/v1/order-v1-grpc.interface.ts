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
}

export interface ICreateOrderItemInput {
   productId: string;
   productName: string;
   quantity: number;
   unitPrice: number;
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

export interface IOrderV1GrpcService {
   createOrder(request: ICreateOrderRequest, metadata?: Metadata): Observable<ICreateOrderResponse>;
   getOrderById(request: IGetOrderByIdRequest, metadata?: Metadata): Observable<IGetOrderByIdResponse>;
   getOrdersByUserId(request: IGetOrdersByUserIdRequest, metadata?: Metadata): Observable<IGetOrdersByUserIdResponse>;
   cancelOrder(request: ICancelOrderRequest, metadata?: Metadata): Observable<ICancelOrderResponse>;
   updateOrderStatus(request: IUpdateOrderStatusRequest, metadata?: Metadata): Observable<IUpdateOrderStatusResponse>;
}

export type IOrderGrpcService = IOrderV1GrpcService;
