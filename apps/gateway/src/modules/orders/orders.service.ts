import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { defer, firstValueFrom } from 'rxjs';
import {
   BulkheadRegistry,
   CircuitBreakerRegistry,
   createGrpcMetadata,
   handleGrpcError,
   RetryPolicyRegistry,
   withGrpcRetry,
} from '@common';
import {
   ORDER_V1_GRPC_CLIENT,
   ORDER_V1_GRPC_SERVICE_NAME,
   type CreateOrderDto,
   type IOrderProto,
   type IOrderV1GrpcService,
   type OrderResponseDto,
} from '@contracts/order';

@Injectable()
export class OrdersService implements OnModuleInit {
   private readonly logger = new Logger(OrdersService.name);
   private orderGrpcService!: IOrderV1GrpcService;

   private readonly bulkhead = BulkheadRegistry.getOrCreate(ORDER_V1_GRPC_SERVICE_NAME, {
      maxConcurrent: 50,
      maxQueueCapacity: 100,
   });

   private readonly circuitBreaker = CircuitBreakerRegistry.getOrCreate(ORDER_V1_GRPC_SERVICE_NAME, {
      timeout: 5000,
      failureThreshold: 5,
      resetTimeout: 10000,
   });

   private readonly retryPolicy = RetryPolicyRegistry.getOrCreate(ORDER_V1_GRPC_SERVICE_NAME, {
      maxAttempts: 3,
      initialDelayMs: 100,
      multiplier: 2,
      maxDelayMs: 2000,
   });

   constructor(
      @Inject(ORDER_V1_GRPC_CLIENT)
      private readonly orderGrpcClient: ClientGrpc,
   ) {}

   onModuleInit(): void {
      this.orderGrpcService = this.orderGrpcClient.getService<IOrderV1GrpcService>(ORDER_V1_GRPC_SERVICE_NAME);
   }

   async createOrder(userId: string, dto: CreateOrderDto, correlationId?: string): Promise<OrderResponseDto> {
      try {
         const metadata = createGrpcMetadata({ correlationId, userId });
         const response = await this.bulkhead.execute(() =>
            this.circuitBreaker.execute(() =>
               firstValueFrom(
                  defer(() =>
                     this.orderGrpcService.createOrder(
                        {
                           userId,
                           paymentMethod: dto.paymentMethod,
                           shippingAddress: dto.shippingAddress,
                           receiverName: dto.receiverName,
                           receiverPhone: dto.receiverPhone,
                           note: dto.note,
                           shippingFee: dto.shippingFee,
                           items: dto.items,
                        },
                        metadata,
                     ),
                  ).pipe(withGrpcRetry(this.retryPolicy)),
               ),
            ),
         );

         return response.order as unknown as OrderResponseDto;
      } catch (error: unknown) {
         return handleGrpcError(error);
      }
   }

   async getOrderById(orderId: string, userId: string, correlationId?: string): Promise<OrderResponseDto> {
      try {
         const metadata = createGrpcMetadata({ correlationId, userId });
         const response = await this.bulkhead.execute(() =>
            this.circuitBreaker.execute(() =>
               firstValueFrom(
                  defer(() => this.orderGrpcService.getOrderById({ orderId, userId }, metadata)).pipe(
                     withGrpcRetry(this.retryPolicy),
                  ),
               ),
            ),
         );

         return response.order as unknown as OrderResponseDto;
      } catch (error: unknown) {
         return handleGrpcError(error);
      }
   }

   async getOrdersByUserId(
      userId: string,
      page: number,
      limit: number,
      correlationId?: string,
   ): Promise<{ orders: IOrderProto[]; total: number; page: number; limit: number }> {
      try {
         const metadata = createGrpcMetadata({ correlationId, userId });
         const response = await this.bulkhead.execute(() =>
            this.circuitBreaker.execute(() =>
               firstValueFrom(
                  defer(() => this.orderGrpcService.getOrdersByUserId({ userId, page, limit }, metadata)).pipe(
                     withGrpcRetry(this.retryPolicy),
                  ),
               ),
            ),
         );

         return response;
      } catch (error: unknown) {
         return handleGrpcError(error);
      }
   }

   async cancelOrder(
      orderId: string,
      userId: string,
      reason?: string,
      correlationId?: string,
   ): Promise<OrderResponseDto> {
      try {
         const metadata = createGrpcMetadata({ correlationId, userId });
         const response = await this.bulkhead.execute(() =>
            this.circuitBreaker.execute(() =>
               firstValueFrom(
                  defer(() => this.orderGrpcService.cancelOrder({ orderId, userId, reason }, metadata)).pipe(
                     withGrpcRetry(this.retryPolicy),
                  ),
               ),
            ),
         );

         return response.order as unknown as OrderResponseDto;
      } catch (error: unknown) {
         return handleGrpcError(error);
      }
   }
}
