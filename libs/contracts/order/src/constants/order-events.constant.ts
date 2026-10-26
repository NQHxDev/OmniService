export const ORDER_EVENTS = {
   ORDER_CREATED: 'order.created',
   ORDER_CONFIRMED: 'order.confirmed',
   ORDER_CANCELLED: 'order.cancelled',
   ORDER_STATUS_CHANGED: 'order.status_changed',
} as const;

export type OrderEvent = (typeof ORDER_EVENTS)[keyof typeof ORDER_EVENTS];

export interface IOrderCreatedEvent {
   orderId: string;
   userId: string;
   orderNumber: string;
   totalAmount: number;
   paymentMethod: string;
   paymentStatus: string;
   shippingFee: number;
   items: Array<{
      productId: string;
      productName: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
   }>;
}

export interface IOrderStatusChangedEvent {
   orderId: string;
   userId: string;
   orderNumber: string;
   previousStatus: string;
   currentStatus: string;
   paymentStatus?: string;
   updatedAt: string;
}
