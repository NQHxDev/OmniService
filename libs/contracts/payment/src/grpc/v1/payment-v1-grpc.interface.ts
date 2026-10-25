import type { Observable } from 'rxjs';
import type { Metadata } from '@grpc/grpc-js';

export interface IPaymentTransactionProto {
   transactionId: string;
   orderId: string;
   userId: string;
   amount: number;
   currency: string;
   paymentMethod: string;
   paymentStatus: string;
   providerTransactionId?: string;
   paymentUrl?: string;
   failureReason?: string;
   createdAt: string;
   updatedAt: string;
}

export interface IInitiatePaymentRequest {
   orderId: string;
   userId: string;
   amount: number;
   currency?: string;
   paymentMethod: string;
   returnUrl?: string;
   ipAddress?: string;
   orderDescription?: string;
}

export interface IInitiatePaymentResponse {
   transaction: IPaymentTransactionProto;
   paymentUrl?: string;
   requiresRedirect: boolean;
}

export interface IGetPaymentByIdRequest {
   transactionId: string;
}

export interface IGetPaymentByOrderIdRequest {
   orderId: string;
}

export interface IGetPaymentResponse {
   transaction: IPaymentTransactionProto;
}

export interface IProcessWebhookRequest {
   provider: string;
   rawPayload: string;
   signature?: string;
   queryParams?: Record<string, string>;
}

export interface IProcessWebhookResponse {
   success: boolean;
   message: string;
   transactionId?: string;
   paymentStatus?: string;
}

export interface IRefundPaymentRequest {
   transactionId: string;
   amount: number;
   reason?: string;
}

export interface IRefundPaymentResponse {
   success: boolean;
   message: string;
   refundId: string;
}

export interface IPaymentV1GrpcService {
   initiatePayment(request: IInitiatePaymentRequest, metadata?: Metadata): Observable<IInitiatePaymentResponse>;
   getPaymentById(request: IGetPaymentByIdRequest, metadata?: Metadata): Observable<IGetPaymentResponse>;
   getPaymentByOrderId(request: IGetPaymentByOrderIdRequest, metadata?: Metadata): Observable<IGetPaymentResponse>;
   processWebhook(request: IProcessWebhookRequest, metadata?: Metadata): Observable<IProcessWebhookResponse>;
   refundPayment(request: IRefundPaymentRequest, metadata?: Metadata): Observable<IRefundPaymentResponse>;
}

export type IPaymentGrpcService = IPaymentV1GrpcService;
