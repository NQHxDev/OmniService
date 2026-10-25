import type { Order, OrderItem, OrderStatusEnum, PaymentMethodEnum, PaymentStatusEnum } from '@order/prisma-client';

export type OrderItemEntity = OrderItem;
export type OrderEntity = Order;
export type OrderWithItems = Order & { items: OrderItem[] };

export interface CreateOrderItemData {
   productId: string;
   productName: string;
   quantity: number;
   unitPrice: number;
   totalPrice: number;
}

export interface CreateOrderData {
   userId: string;
   orderNumber: string;
   orderStatus: OrderStatusEnum;
   paymentMethod: PaymentMethodEnum;
   paymentStatus: PaymentStatusEnum;
   totalAmount: number;
   shippingFee: number;
   shippingAddress: string;
   receiverName: string;
   receiverPhone: string;
   note?: string;
   items: CreateOrderItemData[];
}
