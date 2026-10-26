import { Controller, UseFilters, UseInterceptors } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import type { Metadata } from '@grpc/grpc-js';
import { from, Observable } from 'rxjs';
import { GrpcExceptionFilter, GrpcLoggingInterceptor, GrpcMetricsInterceptor } from '@common';
import {
   ORDER_V1_GRPC_SERVICE_NAME,
   ORDER_V1_GRPC_METHODS,
   type ICancelOrderRequest,
   type ICancelOrderResponse,
   type ICreateOrderRequest,
   type ICreateOrderResponse,
   type IGetOrderByIdRequest,
   type IGetOrderByIdResponse,
   type IGetOrdersByUserIdRequest,
   type IGetOrdersByUserIdResponse,
   type IOrderProto,
   type IOrderV1GrpcService,
   type IUpdateOrderStatusRequest,
   type IUpdateOrderStatusResponse,
} from '@contracts/order';
import type { OrderWithItems } from '@order/entities';
import { CancelOrderCommandHandler, CreateOrderCommandHandler, UpdateOrderStatusCommandHandler } from '@order/commands';
import { GetOrderByIdQueryHandler, GetOrdersByUserIdQueryHandler } from '@order/queries';
import { validateOrderUserId } from '@order/utils';

function mapOrderToProto(order: OrderWithItems): IOrderProto {
   return {
      orderId: order.orderId,
      userId: order.userId,
      orderNumber: order.orderNumber,
      orderStatus: order.orderStatus,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      totalAmount: Number(order.totalAmount),
      shippingFee: Number(order.shippingFee),
      shippingAddress: order.shippingAddress,
      receiverName: order.receiverName,
      receiverPhone: order.receiverPhone,
      note: order.note ?? '',
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      items: (order.items || []).map((item) => ({
         orderItemId: item.orderItemId,
         orderId: item.orderId,
         productId: item.productId,
         productName: item.productName,
         quantity: item.quantity,
         unitPrice: Number(item.unitPrice),
         totalPrice: Number(item.totalPrice),
      })),
   };
}

@Controller()
@UseFilters(GrpcExceptionFilter)
@UseInterceptors(GrpcLoggingInterceptor, GrpcMetricsInterceptor)
export class OrderGrpcController implements IOrderV1GrpcService {
   constructor(
      private readonly createOrderHandler: CreateOrderCommandHandler,
      private readonly cancelOrderHandler: CancelOrderCommandHandler,
      private readonly updateOrderStatusHandler: UpdateOrderStatusCommandHandler,
      private readonly getOrderByIdHandler: GetOrderByIdQueryHandler,
      private readonly getOrdersByUserIdHandler: GetOrdersByUserIdQueryHandler,
   ) {}

   @GrpcMethod(ORDER_V1_GRPC_SERVICE_NAME, ORDER_V1_GRPC_METHODS.CREATE_ORDER)
   createOrder(request: ICreateOrderRequest, _metadata?: Metadata): Observable<ICreateOrderResponse> {
      validateOrderUserId(request.userId);
      return from(
         this.createOrderHandler.execute(request).then((order) => ({
            order: mapOrderToProto(order),
         })),
      );
   }

   @GrpcMethod(ORDER_V1_GRPC_SERVICE_NAME, ORDER_V1_GRPC_METHODS.GET_ORDER_BY_ID)
   getOrderById(request: IGetOrderByIdRequest, metadata?: Metadata): Observable<IGetOrderByIdResponse> {
      validateOrderUserId(request.userId);
      return from(
         this.getOrderByIdHandler.execute(request, metadata).then((order) => ({
            order: mapOrderToProto(order),
         })),
      );
   }

   @GrpcMethod(ORDER_V1_GRPC_SERVICE_NAME, ORDER_V1_GRPC_METHODS.GET_ORDERS_BY_USER_ID)
   getOrdersByUserId(request: IGetOrdersByUserIdRequest, metadata?: Metadata): Observable<IGetOrdersByUserIdResponse> {
      validateOrderUserId(request.userId);
      return from(
         this.getOrdersByUserIdHandler.execute(request, metadata).then((result) => ({
            orders: result.orders.map(mapOrderToProto),
            total: result.total,
            page: result.page,
            limit: result.limit,
         })),
      );
   }

   @GrpcMethod(ORDER_V1_GRPC_SERVICE_NAME, ORDER_V1_GRPC_METHODS.CANCEL_ORDER)
   cancelOrder(request: ICancelOrderRequest, metadata?: Metadata): Observable<ICancelOrderResponse> {
      validateOrderUserId(request.userId);
      return from(
         this.cancelOrderHandler.execute(request, metadata).then((order) => ({
            order: mapOrderToProto(order),
         })),
      );
   }

   @GrpcMethod(ORDER_V1_GRPC_SERVICE_NAME, ORDER_V1_GRPC_METHODS.UPDATE_ORDER_STATUS)
   updateOrderStatus(request: IUpdateOrderStatusRequest, _metadata?: Metadata): Observable<IUpdateOrderStatusResponse> {
      return from(
         this.updateOrderStatusHandler.execute(request).then((order) => ({
            order: mapOrderToProto(order),
         })),
      );
   }
}
