import type { OrderStatusEnum, PaymentStatusEnum } from '@order/prisma-client';
import type { CreateOrderData, OrderWithItems } from '@order/entities/order.entity';

export const ORDER_REPOSITORY = Symbol('ORDER_REPOSITORY');

export interface IOrderRepository {
   create(data: CreateOrderData): Promise<OrderWithItems>;
   findById(orderId: string): Promise<OrderWithItems | null>;
   findByOrderNumber(orderNumber: string): Promise<OrderWithItems | null>;
   findByUserId(userId: string, page: number, limit: number): Promise<{ orders: OrderWithItems[]; total: number }>;
   updateStatus(orderId: string, status: OrderStatusEnum, paymentStatus?: PaymentStatusEnum): Promise<OrderWithItems>;
   cancel(orderId: string, reason?: string): Promise<OrderWithItems>;
}
