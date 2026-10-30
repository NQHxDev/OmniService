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
   DEFAULT_SHIPPING_METHOD,
   ORDER_V1_GRPC_CLIENT,
   ORDER_V1_GRPC_SERVICE_NAME,
   type CreateOrderDto,
   type IOrderProto,
   type IProductOrderStatsProto,
   type IOrderV1GrpcService,
   type ListSupplierOrdersQueryDto,
   type OrderResponseDto,
   type SupplierOrderDetailDto,
   type SupplierOrderListResponseDto,
   type UpdateSupplierOrderStatusDto,
   type UpdateSupplierOrderStatusResponseDto,
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
                           supplierId: dto.supplierId || '5097672a-87b6-4871-8a48-df6159b97a60',
                           shippingMethod: dto.shippingMethod,
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

   async getProductOrderStats(productIds: string[], correlationId?: string): Promise<IProductOrderStatsProto[]> {
      try {
         const metadata = createGrpcMetadata({ correlationId });
         const response = await this.bulkhead.execute(() =>
            this.circuitBreaker.execute(() =>
               firstValueFrom(
                  defer(() => this.orderGrpcService.getProductOrderStats({ productIds }, metadata)).pipe(
                     withGrpcRetry(this.retryPolicy),
                  ),
               ),
            ),
         );

         return response.stats ?? [];
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

   async listSupplierOrders(
      supplierId: string,
      query: ListSupplierOrdersQueryDto,
      correlationId?: string,
   ): Promise<SupplierOrderListResponseDto> {
      try {
         const metadata = createGrpcMetadata({ correlationId, supplierId });
         const response = await this.bulkhead.execute(() =>
            this.circuitBreaker.execute(() =>
               firstValueFrom(
                  defer(() =>
                     this.orderGrpcService.listSupplierOrders(
                        {
                           supplierId,
                           page: query.page,
                           limit: query.limit,
                           group: query.group,
                           status: query.status,
                           dateRange: query.dateRange,
                           startDate: query.startDate,
                           endDate: query.endDate,
                           shippingMethod: query.shippingMethod,
                           paymentStatus: query.paymentStatus,
                           search: query.search,
                           sortBy: query.sortBy,
                           sortOrder: query.sortOrder,
                        },
                        metadata,
                     ),
                  ).pipe(withGrpcRetry(this.retryPolicy)),
               ),
            ),
         );

         return {
            items: (response.items || []).map((item) => ({
               orderId: item.orderId,
               id: item.orderId,
               orderNumber: item.orderNumber,
               customerName: item.customerName,
               customerPhone: item.customerPhone,
               deliveryAddress: item.deliveryAddress,
               shippingMethod: item.shippingMethod || DEFAULT_SHIPPING_METHOD,
               totalAmount: item.totalAmount,
               shippingFee: item.shippingFee,
               status: item.status,
               paymentMethod: item.paymentMethod,
               paymentStatus: item.paymentStatus,
               note: item.note || undefined,
               createdAt: item.createdAt,
               updatedAt: item.updatedAt,
               items: (item.items || []).map((i) => ({
                  orderItemId: i.orderItemId,
                  id: i.orderItemId,
                  productId: i.productId,
                  title: i.title,
                  quantity: i.quantity,
                  price: i.price,
                  totalPrice: i.totalPrice,
                  imageUrl: i.imageUrl || undefined,
               })),
            })),
            pagination: {
               page: response.pagination.page,
               limit: response.pagination.limit,
               totalItems: response.pagination.totalItems,
               totalPages: response.pagination.totalPages,
            },
            summary: {
               shippingCount: response.summary.shippingCount,
               needsActionCount: response.summary.needsActionCount,
            },
         };
      } catch (error: unknown) {
         return handleGrpcError(error);
      }
   }

   async getSupplierOrderById(
      orderId: string,
      supplierId: string,
      correlationId?: string,
   ): Promise<SupplierOrderDetailDto> {
      try {
         const metadata = createGrpcMetadata({ correlationId, supplierId });
         const response = await this.bulkhead.execute(() =>
            this.circuitBreaker.execute(() =>
               firstValueFrom(
                  defer(() => this.orderGrpcService.getSupplierOrderById({ orderId, supplierId }, metadata)).pipe(
                     withGrpcRetry(this.retryPolicy),
                  ),
               ),
            ),
         );

         const order = response.order;
         return {
            orderId: order.orderId,
            id: order.orderId,
            orderNumber: order.orderNumber,
            customer: {
               userId: order.customer.userId,
               name: order.customer.name,
               phone: order.customer.phone,
               avatar: order.customer.avatar || undefined,
            },
            shippingAddress: order.shippingAddress,
            shippingMethod: order.shippingMethod || DEFAULT_SHIPPING_METHOD,
            status: order.status,
            paymentMethod: order.paymentMethod,
            paymentStatus: order.paymentStatus,
            totalAmount: order.totalAmount,
            subTotal: order.subTotal,
            shippingFee: order.shippingFee,
            discountAmount: order.discountAmount,
            note: order.note || undefined,
            items: (order.items || []).map((i) => ({
               orderItemId: i.orderItemId,
               id: i.orderItemId,
               productId: i.productId,
               title: i.title,
               quantity: i.quantity,
               price: i.price,
               totalPrice: i.totalPrice,
               imageUrl: i.imageUrl || undefined,
            })),
            timeline: (order.timeline || []).map((t) => ({
               status: t.status,
               time: t.time,
               description: t.description,
            })),
            createdAt: order.createdAt,
            updatedAt: order.updatedAt,
         };
      } catch (error: unknown) {
         return handleGrpcError(error);
      }
   }

   async updateSupplierOrderStatus(
      orderId: string,
      supplierId: string,
      dto: UpdateSupplierOrderStatusDto,
      correlationId?: string,
   ): Promise<UpdateSupplierOrderStatusResponseDto> {
      try {
         const metadata = createGrpcMetadata({ correlationId, supplierId });
         const response = await this.bulkhead.execute(() =>
            this.circuitBreaker.execute(() =>
               firstValueFrom(
                  defer(() =>
                     this.orderGrpcService.updateSupplierOrderStatus(
                        {
                           orderId,
                           supplierId,
                           status: dto.status,
                           reason: dto.reason,
                           shipperTrackingCode: dto.shipperTrackingCode,
                        },
                        metadata,
                     ),
                  ).pipe(withGrpcRetry(this.retryPolicy)),
               ),
            ),
         );

         return {
            orderId: response.orderId,
            status: response.status,
            updatedAt: response.updatedAt,
         };
      } catch (error: unknown) {
         return handleGrpcError(error);
      }
   }
}
