import { Inject, Injectable, Logger } from '@nestjs/common';
import { BadRequestException } from '@common';
import { ORDER_REPOSITORY, type IOrderRepository } from '@order/repositories';
import {
   DEFAULT_SHIPPING_METHOD,
   ORDER_ERROR_CODES,
   SORT_ORDERS,
   type IListSupplierOrdersRequest,
   type IListSupplierOrdersResponse,
} from '@contracts/order';
import type { OrderStatusEnum } from '@order/prisma-client';

@Injectable()
export class ListSupplierOrdersQueryHandler {
   private readonly logger = new Logger(ListSupplierOrdersQueryHandler.name);

   constructor(@Inject(ORDER_REPOSITORY) private readonly orderRepository: IOrderRepository) {}

   async execute(dto: IListSupplierOrdersRequest): Promise<IListSupplierOrdersResponse> {
      if (!dto.supplierId || dto.supplierId.trim().length === 0) {
         throw new BadRequestException(ORDER_ERROR_CODES.SUPPLIER_ID_REQUIRED);
      }

      const page = Math.max(1, Number(dto.page) || 1);
      const limit = Math.max(1, Math.min(100, Number(dto.limit) || 20));

      const result = await this.orderRepository.findSupplierOrders({
         supplierId: dto.supplierId,
         page,
         limit,
         group: dto.group,
         status: dto.status as OrderStatusEnum | undefined,
         dateRange: dto.dateRange,
         startDate: dto.startDate,
         endDate: dto.endDate,
         shippingMethod: dto.shippingMethod,
         paymentStatus: dto.paymentStatus,
         search: dto.search,
         sortBy: dto.sortBy,
         sortOrder: dto.sortOrder?.toLowerCase() === SORT_ORDERS.ASC ? SORT_ORDERS.ASC : SORT_ORDERS.DESC,
      });

      const totalPages = Math.ceil(result.total / limit) || 1;

      const items = result.orders.map((order) => {
         const orderItems = (order.items || []).map((item) => ({
            orderItemId: item.orderItemId,
            productId: item.productId,
            title: item.productName,
            quantity: item.quantity,
            price: Number(item.unitPrice),
            totalPrice: Number(item.totalPrice),
            imageUrl: item.imageUrl || undefined,
         }));

         return {
            orderId: order.orderId,
            orderNumber: order.orderNumber,
            customerName: order.receiverName,
            customerPhone: order.receiverPhone,
            deliveryAddress: order.shippingAddress,
            shippingMethod: order.shippingMethod || DEFAULT_SHIPPING_METHOD,
            totalAmount: Number(order.totalAmount),
            shippingFee: Number(order.shippingFee),
            status: order.orderStatus,
            paymentMethod: order.paymentMethod,
            paymentStatus: order.paymentStatus,
            note: order.note || undefined,
            createdAt: order.createdAt.toISOString(),
            updatedAt: order.updatedAt.toISOString(),
            items: orderItems,
         };
      });

      return {
         items,
         pagination: {
            page,
            limit,
            totalItems: result.total,
            totalPages,
         },
         summary: {
            shippingCount: result.shippingCount,
            needsActionCount: result.needsActionCount,
         },
      };
   }
}
