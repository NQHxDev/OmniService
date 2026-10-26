import { Controller, UseFilters, UseInterceptors } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import type { Metadata } from '@grpc/grpc-js';
import { from, Observable } from 'rxjs';
import {
   checkRoles,
   DEFAULT_ROLES,
   GrpcExceptionFilter,
   GrpcLoggingInterceptor,
   GrpcMetricsInterceptor,
} from '@common';
import {
   PAYMENT_V1_GRPC_SERVICE_NAME,
   PAYMENT_V1_GRPC_METHODS,
   type IGetPaymentByIdRequest,
   type IGetPaymentByOrderIdRequest,
   type IGetPaymentResponse,
   type IInitiatePaymentRequest,
   type IInitiatePaymentResponse,
   type IPaymentV1GrpcService,
   type IProcessWebhookRequest,
   type IProcessWebhookResponse,
   type IRefundPaymentRequest,
   type IRefundPaymentResponse,
} from '@contracts/payment';
import { PaymentService } from '@payment/services/payment.service';

@Controller()
@UseFilters(GrpcExceptionFilter)
@UseInterceptors(GrpcLoggingInterceptor, GrpcMetricsInterceptor)
export class PaymentGrpcController implements IPaymentV1GrpcService {
   constructor(private readonly paymentService: PaymentService) {}

   @GrpcMethod(PAYMENT_V1_GRPC_SERVICE_NAME, PAYMENT_V1_GRPC_METHODS.INITIATE_PAYMENT)
   initiatePayment(request: IInitiatePaymentRequest, _metadata?: Metadata): Observable<IInitiatePaymentResponse> {
      return from(this.paymentService.initiatePayment(request));
   }

   @GrpcMethod(PAYMENT_V1_GRPC_SERVICE_NAME, PAYMENT_V1_GRPC_METHODS.GET_PAYMENT_BY_ID)
   getPaymentById(request: IGetPaymentByIdRequest, metadata?: Metadata): Observable<IGetPaymentResponse> {
      return from(
         this.paymentService.getPaymentById(request.transactionId, metadata).then((transaction) => ({
            transaction,
         })),
      );
   }

   @GrpcMethod(PAYMENT_V1_GRPC_SERVICE_NAME, PAYMENT_V1_GRPC_METHODS.GET_PAYMENT_BY_ORDER_ID)
   getPaymentByOrderId(request: IGetPaymentByOrderIdRequest, metadata?: Metadata): Observable<IGetPaymentResponse> {
      return from(
         this.paymentService.getPaymentByOrderId(request.orderId, metadata).then((transaction) => ({
            transaction,
         })),
      );
   }

   @GrpcMethod(PAYMENT_V1_GRPC_SERVICE_NAME, PAYMENT_V1_GRPC_METHODS.PROCESS_WEBHOOK)
   processWebhook(request: IProcessWebhookRequest, _metadata?: Metadata): Observable<IProcessWebhookResponse> {
      return from(this.paymentService.processWebhook(request));
   }

   @GrpcMethod(PAYMENT_V1_GRPC_SERVICE_NAME, PAYMENT_V1_GRPC_METHODS.REFUND_PAYMENT)
   refundPayment(request: IRefundPaymentRequest, metadata?: Metadata): Observable<IRefundPaymentResponse> {
      checkRoles(metadata, [DEFAULT_ROLES.ADMIN]);
      return from(this.paymentService.refundPayment(request, metadata));
   }
}
