import { Injectable } from '@nestjs/common';
import { PrismaService } from '@order/prisma/prisma.service';
import { Prisma, type OrderStatusEnum, type PaymentStatusEnum } from '@order/prisma-client';
import {
   DEFAULT_SHIPPING_METHOD,
   FILTER_ALL,
   ORDER_STATUS,
   PAYMENT_METHODS,
   PAYMENT_STATUS,
   SORT_ORDERS,
   SUPPLIER_ORDER_DATE_RANGES,
   SUPPLIER_ORDER_GROUPS,
   SUPPLIER_ORDER_GROUP_STATUSES,
   SUPPLIER_ORDER_PAYMENT_STATUSES,
   SUPPLIER_ORDER_SORT_BY,
} from '@contracts/order';
import type { CreateOrderData, OrderWithItems } from '@order/entities/order.entity';
import type {
   FindSupplierOrdersParams,
   FindSupplierOrdersResult,
   IOrderRepository,
   UpdateSupplierOrderStatusParams,
} from '@order/repositories/order.repository.interface';

@Injectable()
export class OrderRepository implements IOrderRepository {
   constructor(private readonly prisma: PrismaService) {}

   async create(data: CreateOrderData): Promise<OrderWithItems> {
      return this.prisma.order.create({
         data: {
            userId: data.userId,
            supplierId: data.supplierId,
            orderNumber: data.orderNumber,
            orderStatus: data.orderStatus,
            paymentMethod: data.paymentMethod,
            paymentStatus: data.paymentStatus,
            shippingMethod: data.shippingMethod || DEFAULT_SHIPPING_METHOD,
            totalAmount: data.totalAmount,
            shippingFee: data.shippingFee,
            shippingAddress: data.shippingAddress,
            receiverName: data.receiverName,
            receiverPhone: data.receiverPhone,
            note: data.note,
            items: {
               create: data.items.map((item) => ({
                  productId: item.productId,
                  productName: item.productName,
                  imageUrl: item.imageUrl,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  totalPrice: item.totalPrice,
               })),
            },
            timelines: {
               create: {
                  status: data.orderStatus,
                  description: 'Order created',
               },
            },
         },
         include: { items: true, timelines: { orderBy: { createdAt: 'asc' } } },
      });
   }

   async findById(orderId: string): Promise<OrderWithItems | null> {
      return this.prisma.order.findUnique({
         where: { orderId },
         include: { items: true, timelines: { orderBy: { createdAt: 'asc' } } },
      });
   }

   async findByOrderNumber(orderNumber: string): Promise<OrderWithItems | null> {
      return this.prisma.order.findUnique({
         where: { orderNumber },
         include: { items: true, timelines: { orderBy: { createdAt: 'asc' } } },
      });
   }

   async findByUserId(
      userId: string,
      page: number,
      limit: number,
   ): Promise<{ orders: OrderWithItems[]; total: number }> {
      const skip = (page - 1) * limit;
      const [orders, total] = await Promise.all([
         this.prisma.order.findMany({
            where: { userId },
            include: { items: true, timelines: { orderBy: { createdAt: 'asc' } } },
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' },
         }),
         this.prisma.order.count({ where: { userId } }),
      ]);

      return { orders, total };
   }

   async updateStatus(
      orderId: string,
      status: OrderStatusEnum,
      paymentStatus?: PaymentStatusEnum,
   ): Promise<OrderWithItems> {
      return this.prisma.order.update({
         where: { orderId },
         data: {
            orderStatus: status,
            ...(paymentStatus ? { paymentStatus } : {}),
         },
         include: { items: true, timelines: { orderBy: { createdAt: 'asc' } } },
      });
   }

   async cancel(orderId: string, reason?: string): Promise<OrderWithItems> {
      return this.prisma.order.update({
         where: { orderId },
         data: {
            orderStatus: ORDER_STATUS.CANCELLED,
            ...(reason ? { cancelReason: reason, note: reason } : {}),
            timelines: {
               create: {
                  status: ORDER_STATUS.CANCELLED,
                  description: reason || 'Order cancelled',
               },
            },
         },
         include: { items: true, timelines: { orderBy: { createdAt: 'asc' } } },
      });
   }

   async findSupplierOrders(params: FindSupplierOrdersParams): Promise<FindSupplierOrdersResult> {
      const page = Math.max(1, Number(params.page) || 1);
      const limit = Math.max(1, Math.min(100, Number(params.limit) || 20));
      const skip = (page - 1) * limit;

      // Construct Prisma where clause
      const where: Prisma.OrderWhereInput = {
         supplierId: params.supplierId,
      };

      // Group filter using domain constants
      if (params.group === SUPPLIER_ORDER_GROUPS.SHIPPING) {
         where.orderStatus = { in: [...SUPPLIER_ORDER_GROUP_STATUSES[SUPPLIER_ORDER_GROUPS.SHIPPING]] };
      } else if (params.group === SUPPLIER_ORDER_GROUPS.NEEDS_ACTION) {
         where.orderStatus = { in: [...SUPPLIER_ORDER_GROUP_STATUSES[SUPPLIER_ORDER_GROUPS.NEEDS_ACTION]] };
      }

      // Explicit status override / specific filter
      if (params.status) {
         where.orderStatus = params.status;
      }

      // Shipping Method filter
      if (params.shippingMethod && params.shippingMethod !== FILTER_ALL) {
         where.shippingMethod = { equals: params.shippingMethod, mode: Prisma.QueryMode.insensitive };
      }

      // Payment Status filter
      if (params.paymentStatus && params.paymentStatus !== FILTER_ALL) {
         if (params.paymentStatus === SUPPLIER_ORDER_PAYMENT_STATUSES.COD) {
            where.paymentMethod = PAYMENT_METHODS.COD;
         } else if (
            params.paymentStatus === SUPPLIER_ORDER_PAYMENT_STATUSES.PAID ||
            params.paymentStatus === PAYMENT_STATUS.SUCCESS
         ) {
            where.paymentStatus = PAYMENT_STATUS.SUCCESS;
         } else if (
            params.paymentStatus === SUPPLIER_ORDER_PAYMENT_STATUSES.UNPAID ||
            params.paymentStatus === PAYMENT_STATUS.PENDING
         ) {
            where.paymentStatus = PAYMENT_STATUS.PENDING;
         } else {
            where.paymentStatus = params.paymentStatus as PaymentStatusEnum;
         }
      }

      // Date Range filter
      if (params.startDate || params.endDate) {
         where.createdAt = {
            ...(params.startDate ? { gte: new Date(params.startDate) } : {}),
            ...(params.endDate ? { lte: new Date(params.endDate) } : {}),
         };
      } else if (params.dateRange && params.dateRange !== SUPPLIER_ORDER_DATE_RANGES.ALL) {
         const now = new Date();
         if (params.dateRange === SUPPLIER_ORDER_DATE_RANGES.TODAY) {
            const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
            where.createdAt = { gte: startOfToday };
         } else if (params.dateRange === SUPPLIER_ORDER_DATE_RANGES.YESTERDAY) {
            const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
            const endOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
            where.createdAt = { gte: startOfYesterday, lte: endOfYesterday };
         } else if (params.dateRange === SUPPLIER_ORDER_DATE_RANGES.LAST_7_DAYS) {
            const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            where.createdAt = { gte: sevenDaysAgo };
         } else if (params.dateRange === SUPPLIER_ORDER_DATE_RANGES.THIS_MONTH) {
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
            where.createdAt = { gte: startOfMonth };
         }
      }

      // Search keyword filter
      if (params.search && params.search.trim().length > 0) {
         const searchTerm = params.search.trim();
         where.OR = [
            { orderNumber: { contains: searchTerm, mode: Prisma.QueryMode.insensitive } },
            { receiverName: { contains: searchTerm, mode: Prisma.QueryMode.insensitive } },
            { receiverPhone: { contains: searchTerm, mode: Prisma.QueryMode.insensitive } },
            {
               items: {
                  some: {
                     productName: { contains: searchTerm, mode: Prisma.QueryMode.insensitive },
                  },
               },
            },
         ];
      }

      // Sorting
      const sortField =
         params.sortBy === SUPPLIER_ORDER_SORT_BY.TOTAL_AMOUNT
            ? SUPPLIER_ORDER_SORT_BY.TOTAL_AMOUNT
            : SUPPLIER_ORDER_SORT_BY.CREATED_AT;
      const sortDirection = params.sortOrder?.toLowerCase() === SORT_ORDERS.ASC ? SORT_ORDERS.ASC : SORT_ORDERS.DESC;
      const orderBy = { [sortField]: sortDirection };

      // Parallel query execution with badge summary counts
      const [orders, total, shippingCount, needsActionCount] = await Promise.all([
         this.prisma.order.findMany({
            where,
            include: { items: true, timelines: { orderBy: { createdAt: 'asc' } } },
            skip,
            take: limit,
            orderBy,
         }),
         this.prisma.order.count({ where }),
         this.prisma.order.count({
            where: {
               supplierId: params.supplierId,
               orderStatus: { in: [...SUPPLIER_ORDER_GROUP_STATUSES[SUPPLIER_ORDER_GROUPS.SHIPPING]] },
            },
         }),
         this.prisma.order.count({
            where: {
               supplierId: params.supplierId,
               orderStatus: { in: [...SUPPLIER_ORDER_GROUP_STATUSES[SUPPLIER_ORDER_GROUPS.NEEDS_ACTION]] },
            },
         }),
      ]);

      return {
         orders,
         total,
         page,
         limit,
         shippingCount,
         needsActionCount,
      };
   }

   async findSupplierOrderById(orderId: string, supplierId?: string): Promise<OrderWithItems | null> {
      return this.prisma.order.findFirst({
         where: {
            orderId,
            ...(supplierId ? { supplierId } : {}),
         },
         include: { items: true, timelines: { orderBy: { createdAt: 'asc' } } },
      });
   }

   async updateSupplierOrderStatus(params: UpdateSupplierOrderStatusParams): Promise<OrderWithItems> {
      return this.prisma.order.update({
         where: { orderId: params.orderId },
         data: {
            orderStatus: params.status,
            ...(params.shipperTrackingCode ? { shipperTrackingCode: params.shipperTrackingCode } : {}),
            ...(params.cancelReason ? { cancelReason: params.cancelReason, note: params.cancelReason } : {}),
            timelines: {
               create: {
                  status: params.status,
                  description: params.description,
               },
            },
         },
         include: { items: true, timelines: { orderBy: { createdAt: 'asc' } } },
      });
   }
}
