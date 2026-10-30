import type { OrderStatusEnum, PaymentStatusEnum } from '@order/prisma-client';
import type { CreateOrderData, OrderWithItems } from '@order/entities/order.entity';

export const ORDER_REPOSITORY = Symbol('ORDER_REPOSITORY');

export interface FindSupplierOrdersParams {
   supplierId: string;
   page: number;
   limit: number;
   group?: string;
   status?: OrderStatusEnum;
   dateRange?: string;
   startDate?: string;
   endDate?: string;
   shippingMethod?: string;
   paymentStatus?: string;
   search?: string;
   sortBy?: string;
   sortOrder?: 'asc' | 'desc';
}

export interface FindSupplierOrdersResult {
   orders: OrderWithItems[];
   total: number;
   page: number;
   limit: number;
   shippingCount: number;
   needsActionCount: number;
}

export interface UpdateSupplierOrderStatusParams {
   orderId: string;
   status: OrderStatusEnum;
   description: string;
   shipperTrackingCode?: string;
   cancelReason?: string;
}

export interface IOrderRepository {
   create(data: CreateOrderData): Promise<OrderWithItems>;
   findById(orderId: string): Promise<OrderWithItems | null>;
   findByOrderNumber(orderNumber: string): Promise<OrderWithItems | null>;
   findByUserId(userId: string, page: number, limit: number): Promise<{ orders: OrderWithItems[]; total: number }>;
   updateStatus(orderId: string, status: OrderStatusEnum, paymentStatus?: PaymentStatusEnum): Promise<OrderWithItems>;
   cancel(orderId: string, reason?: string): Promise<OrderWithItems>;

   findSupplierOrders(params: FindSupplierOrdersParams): Promise<FindSupplierOrdersResult>;
   findSupplierOrderById(orderId: string, supplierId?: string): Promise<OrderWithItems | null>;
   updateSupplierOrderStatus(params: UpdateSupplierOrderStatusParams): Promise<OrderWithItems>;
}
