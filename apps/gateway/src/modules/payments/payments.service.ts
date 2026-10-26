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
import {
   PAYMENT_V1_GRPC_CLIENT,
   PAYMENT_V1_GRPC_SERVICE_NAME,
   type InitiatePaymentDto,
   type InitiatePaymentResponseDto,
   type IPaymentV1GrpcService,
   type PaymentTransactionResponseDto,
   type RefundPaymentDto,
   type WebhookProcessingResponseDto,
} from '@contracts/payment';
import { OrdersService } from '@/modules/orders/orders.service';

@Injectable()
export class PaymentsService implements OnModuleInit {
   private readonly logger = new Logger(PaymentsService.name);
   private paymentGrpcService!: IPaymentV1GrpcService;

   private readonly bulkhead = BulkheadRegistry.getOrCreate(PAYMENT_V1_GRPC_SERVICE_NAME, {
      maxConcurrent: 50,
      maxQueueCapacity: 100,
   });

   private readonly circuitBreaker = CircuitBreakerRegistry.getOrCreate(PAYMENT_V1_GRPC_SERVICE_NAME, {
      timeout: 5000,
      failureThreshold: 5,
      resetTimeout: 10000,
   });

   private readonly retryPolicy = RetryPolicyRegistry.getOrCreate(PAYMENT_V1_GRPC_SERVICE_NAME, {
      maxAttempts: 3,
      initialDelayMs: 100,
      multiplier: 2,
      maxDelayMs: 2000,
   });

   constructor(
      @Inject(PAYMENT_V1_GRPC_CLIENT)
      private readonly paymentGrpcClient: ClientGrpc,
      private readonly ordersService: OrdersService,
   ) {}

   onModuleInit(): void {
      this.paymentGrpcService = this.paymentGrpcClient.getService<IPaymentV1GrpcService>(PAYMENT_V1_GRPC_SERVICE_NAME);
   }

   async initiatePayment(
      userId: string,
      dto: InitiatePaymentDto,
      ipAddress?: string,
      correlationId?: string,
   ): Promise<InitiatePaymentResponseDto> {
      try {
         let amount = dto.amount;
         if (!amount || amount <= 0) {
            const order = await this.ordersService.getOrderById(dto.orderId, userId, correlationId);
            amount = Number(order.totalAmount);
         }

         const metadata = createGrpcMetadata({ correlationId, userId });
         const response = await this.bulkhead.execute(() =>
            this.circuitBreaker.execute(() =>
               firstValueFrom(
                  defer(() =>
                     this.paymentGrpcService.initiatePayment(
                        {
                           orderId: dto.orderId,
                           userId,
                           amount,
                           currency: dto.currency || 'VND',
                           paymentMethod: dto.paymentMethod,
                           returnUrl: dto.returnUrl || '',
                           ipAddress: ipAddress || '127.0.0.1',
                           orderDescription: dto.orderDescription || `Order ${dto.orderId}`,
                        },
                        metadata,
                     ),
                  ).pipe(withGrpcRetry(this.retryPolicy)),
               ),
            ),
         );

         return response as unknown as InitiatePaymentResponseDto;
      } catch (error: unknown) {
         return handleGrpcError(error);
      }
   }

   async getPaymentById(
      transactionId: string,
      user?: JwtPayload,
      correlationId?: string,
   ): Promise<PaymentTransactionResponseDto> {
      try {
         const metadata = createGrpcMetadata({
            correlationId,
            callerService: SERVICE_NAMES.GATEWAY,
            userId: user?.sub,
            accountId: user?.sub,
            roles: user?.roles,
            permissions: user?.permissions,
            email: user?.email,
         });
         const response = await this.bulkhead.execute(() =>
            this.circuitBreaker.execute(() =>
               firstValueFrom(
                  defer(() => this.paymentGrpcService.getPaymentById({ transactionId }, metadata)).pipe(
                     withGrpcRetry(this.retryPolicy),
                  ),
               ),
            ),
         );

         return response.transaction as unknown as PaymentTransactionResponseDto;
      } catch (error: unknown) {
         return handleGrpcError(error);
      }
   }

   async getPaymentByOrderId(
      orderId: string,
      user?: JwtPayload,
      correlationId?: string,
   ): Promise<PaymentTransactionResponseDto> {
      try {
         const metadata = createGrpcMetadata({
            correlationId,
            callerService: SERVICE_NAMES.GATEWAY,
            userId: user?.sub,
            accountId: user?.sub,
            roles: user?.roles,
            permissions: user?.permissions,
            email: user?.email,
         });
         const response = await this.bulkhead.execute(() =>
            this.circuitBreaker.execute(() =>
               firstValueFrom(
                  defer(() => this.paymentGrpcService.getPaymentByOrderId({ orderId }, metadata)).pipe(
                     withGrpcRetry(this.retryPolicy),
                  ),
               ),
            ),
         );

         return response.transaction as unknown as PaymentTransactionResponseDto;
      } catch (error: unknown) {
         return handleGrpcError(error);
      }
   }

   async processWebhook(
      provider: string,
      rawPayload: string,
      signature?: string,
      queryParams?: Record<string, string>,
      correlationId?: string,
   ): Promise<WebhookProcessingResponseDto> {
      try {
         const metadata = createGrpcMetadata({ correlationId });
         const response = await this.bulkhead.execute(() =>
            this.circuitBreaker.execute(() =>
               firstValueFrom(
                  defer(() =>
                     this.paymentGrpcService.processWebhook(
                        {
                           provider,
                           rawPayload,
                           signature: signature || '',
                           queryParams: queryParams || {},
                        },
                        metadata,
                     ),
                  ).pipe(withGrpcRetry(this.retryPolicy)),
               ),
            ),
         );

         return response as unknown as WebhookProcessingResponseDto;
      } catch (error: unknown) {
         return handleGrpcError(error);
      }
   }

   async refundPayment(
      dto: RefundPaymentDto,
      correlationId?: string,
      user?: JwtPayload,
   ): Promise<{ success: boolean; message: string; refundId: string }> {
      try {
         const metadata = createGrpcMetadata({
            correlationId,
            callerService: SERVICE_NAMES.GATEWAY,
            userId: user?.sub,
            accountId: user?.sub,
            roles: user?.roles,
            permissions: user?.permissions,
            email: user?.email,
         });
         const response = await this.bulkhead.execute(() =>
            this.circuitBreaker.execute(() =>
               firstValueFrom(
                  defer(() =>
                     this.paymentGrpcService.refundPayment(
                        {
                           transactionId: dto.transactionId,
                           amount: dto.amount,
                           reason: dto.reason || '',
                        },
                        metadata,
                     ),
                  ).pipe(withGrpcRetry(this.retryPolicy)),
               ),
            ),
         );

         return response;
      } catch (error: unknown) {
         return handleGrpcError(error);
      }
   }
}
