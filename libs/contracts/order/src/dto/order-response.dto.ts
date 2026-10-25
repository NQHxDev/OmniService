import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
   ORDER_STATUS,
   type OrderStatus,
   PAYMENT_METHODS,
   type PaymentMethod,
   PAYMENT_STATUS,
   type PaymentStatus,
} from '@contracts/order/constants/order-status.constant';

export class OrderItemResponseDto {
   @ApiProperty({ description: 'UUID of the order item' })
   orderItemId!: string;

   @ApiProperty({ description: 'UUID of the parent order' })
   orderId!: string;

   @ApiProperty({ description: 'UUID of the product' })
   productId!: string;

   @ApiProperty({ description: 'Name of the product' })
   productName!: string;

   @ApiProperty({ description: 'Quantity ordered' })
   quantity!: number;

   @ApiProperty({ description: 'Unit price' })
   unitPrice!: number;

   @ApiProperty({ description: 'Total price for this line item' })
   totalPrice!: number;
}

export class OrderResponseDto {
   @ApiProperty({ description: 'UUID of the order' })
   orderId!: string;

   @ApiProperty({ description: 'UUID of the ordering user' })
   userId!: string;

   @ApiProperty({ description: 'Human-readable unique order number code' })
   orderNumber!: string;

   @ApiProperty({ enum: ORDER_STATUS, description: 'Current lifecycle status of the order' })
   orderStatus!: OrderStatus;

   @ApiProperty({ enum: PAYMENT_METHODS, description: 'Payment method chosen' })
   paymentMethod!: PaymentMethod;

   @ApiProperty({ enum: PAYMENT_STATUS, description: 'Payment status' })
   paymentStatus!: PaymentStatus;

   @ApiProperty({ description: 'Total financial amount including items and shipping fee' })
   totalAmount!: number;

   @ApiProperty({ description: 'Shipping delivery fee' })
   shippingFee!: number;

   @ApiProperty({ description: 'Delivery street address' })
   shippingAddress!: string;

   @ApiProperty({ description: 'Receiver name' })
   receiverName!: string;

   @ApiProperty({ description: 'Receiver phone number' })
   receiverPhone!: string;

   @ApiPropertyOptional({ description: 'Delivery note' })
   note?: string;

   @ApiProperty({ type: [OrderItemResponseDto], description: 'List of order items' })
   items!: OrderItemResponseDto[];

   @ApiProperty({ description: 'Timestamp when order was created' })
   createdAt!: string;

   @ApiProperty({ description: 'Timestamp when order was last updated' })
   updatedAt!: string;
}

export class OrderListResponseDto {
   @ApiProperty({ type: [OrderResponseDto], description: 'List of retrieved orders' })
   orders!: OrderResponseDto[];

   @ApiProperty({ description: 'Total matching order count' })
   total!: number;

   @ApiProperty({ description: 'Current pagination page index' })
   page!: number;

   @ApiProperty({ description: 'Pagination limit size per page' })
   limit!: number;
}
