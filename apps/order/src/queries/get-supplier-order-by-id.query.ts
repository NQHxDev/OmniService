import { Inject, Injectable, Logger } from '@nestjs/common';
import { status as GrpcStatus } from '@grpc/grpc-js';
import { RpcException } from '@nestjs/microservices';
import { ORDER_REPOSITORY, type IOrderRepository } from '@order/repositories';
import {
   DEFAULT_SHIPPING_METHOD,
   ORDER_ERROR_CODES,
   ORDER_STATUS,
   type IGetSupplierOrderByIdRequest,
   type IGetSupplierOrderByIdResponse,
} from '@contracts/order';

@Injectable()
export class GetSupplierOrderByIdQueryHandler {
   private readonly logger = new Logger(GetSupplierOrderByIdQueryHandler.name);

   constructor(@Inject(ORDER_REPOSITORY) private readonly orderRepository: IOrderRepository) {}

   async execute(dto: IGetSupplierOrderByIdRequest): Promise<IGetSupplierOrderByIdResponse> {
      if (!dto.orderId || dto.orderId.trim().length === 0) {
         throw new RpcException({
            code: GrpcStatus.INVALID_ARGUMENT,
            message: ORDER_ERROR_CODES.ORDER_ID_REQUIRED,
         });
      }

      if (!dto.supplierId || dto.supplierId.trim().length === 0) {
         throw new RpcException({
            code: GrpcStatus.INVALID_ARGUMENT,
            message: ORDER_ERROR_CODES.SUPPLIER_ID_REQUIRED,
         });
      }

      // Check if order exists
      const existingOrder = await this.orderRepository.findById(dto.orderId);
      if (!existingOrder) {
         throw new RpcException({
            code: GrpcStatus.NOT_FOUND,
            message: ORDER_ERROR_CODES.NOT_FOUND,
         });
      }

      // Verify supplier ownership if order has supplierId assigned
      if (existingOrder.supplierId && existingOrder.supplierId !== dto.supplierId) {
         throw new RpcException({
            code: GrpcStatus.PERMISSION_DENIED,
            message: ORDER_ERROR_CODES.FORBIDDEN_SUPPLIER_ORDER,
         });
      }

      const totalAmount = Number(existingOrder.totalAmount);
      const shippingFee = Number(existingOrder.shippingFee);
      const subTotal = Math.max(0, totalAmount - shippingFee);

      const items = (existingOrder.items || []).map((item) => ({
         orderItemId: item.orderItemId,
         productId: item.productId,
         title: item.productName,
         quantity: item.quantity,
         price: Number(item.unitPrice),
         totalPrice: Number(item.totalPrice),
         imageUrl: item.imageUrl || undefined,
      }));

      // Timeline entries (or synthesized default if none recorded yet)
      const timeline =
         existingOrder.timelines && existingOrder.timelines.length > 0
            ? existingOrder.timelines.map((t) => ({
                 status: t.status,
                 time: t.createdAt.toISOString(),
                 description: t.description || `Order status updated to ${t.status}`,
              }))
            : [
                 {
                    status: ORDER_STATUS.PENDING,
                    time: existingOrder.createdAt.toISOString(),
                    description: 'Order created',
                 },
                 ...(existingOrder.orderStatus !== ORDER_STATUS.PENDING
                    ? [
                         {
                            status: existingOrder.orderStatus,
                            time: existingOrder.updatedAt.toISOString(),
                            description: `Order status: ${existingOrder.orderStatus}`,
                         },
                      ]
                    : []),
              ];

      return {
         order: {
            orderId: existingOrder.orderId,
            orderNumber: existingOrder.orderNumber,
            customer: {
               userId: existingOrder.userId,
               name: existingOrder.receiverName,
               phone: existingOrder.receiverPhone,
               avatar: undefined,
            },
            shippingAddress: existingOrder.shippingAddress,
            shippingMethod: existingOrder.shippingMethod || DEFAULT_SHIPPING_METHOD,
            status: existingOrder.orderStatus,
            paymentMethod: existingOrder.paymentMethod,
            paymentStatus: existingOrder.paymentStatus,
            totalAmount,
            subTotal,
            shippingFee,
            discountAmount: 0,
            note: existingOrder.note || undefined,
            items,
            timeline,
            createdAt: existingOrder.createdAt.toISOString(),
            updatedAt: existingOrder.updatedAt.toISOString(),
         },
      };
   }
}
