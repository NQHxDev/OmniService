import type {
   Order,
   OrderItem,
   OrderStatusEnum,
   OrderTimeline,
   PaymentMethodEnum,
   PaymentStatusEnum,
} from '@order/prisma-client';

export type OrderItemEntity = OrderItem;
export type OrderEntity = Order;
export type OrderTimelineEntity = OrderTimeline;
export type OrderWithItems = Order & { items: OrderItem[]; timelines?: OrderTimeline[] };

export interface CreateOrderItemData {
   productId: string;
   productName: string;
   quantity: number;
   unitPrice: number;
   totalPrice: number;
   imageUrl?: string | null;
}

export interface CreateOrderData {
   userId: string;
   supplierId?: string | null;
   orderNumber: string;
   orderStatus: OrderStatusEnum;
   paymentMethod: PaymentMethodEnum;
   paymentStatus: PaymentStatusEnum;
   shippingMethod?: string;
   totalAmount: number;
   shippingFee: number;
   shippingAddress: string;
   receiverName: string;
   receiverPhone: string;
   note?: string | null;
   items: CreateOrderItemData[];
}
