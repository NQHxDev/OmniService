import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';
import { ORDER_STATUS, type OrderStatus } from '@contracts/order/constants/order-status.constant';

import {
   FILTER_ALL,
   SUPPLIER_ORDER_DATE_RANGES,
   SUPPLIER_ORDER_GROUPS,
   SUPPLIER_ORDER_PAYMENT_STATUSES,
   SUPPLIER_ORDER_SHIPPING_METHODS,
   SUPPLIER_ORDER_SORT_BY,
   SUPPLIER_ORDER_TRANSITION_STATUSES,
   type SupplierOrderDateRange,
   type SupplierOrderGroup,
   type SupplierOrderPaymentStatus,
   type SupplierOrderShippingMethod,
   type SupplierOrderSortBy,
   type SupplierOrderTransitionStatus,
} from '@contracts/order/constants/supplier-order.constant';

export {
   FILTER_ALL,
   SUPPLIER_ORDER_DATE_RANGES,
   SUPPLIER_ORDER_GROUPS,
   SUPPLIER_ORDER_PAYMENT_STATUSES,
   SUPPLIER_ORDER_SHIPPING_METHODS,
   SUPPLIER_ORDER_SORT_BY,
   SUPPLIER_ORDER_TRANSITION_STATUSES,
   type SupplierOrderDateRange,
   type SupplierOrderGroup,
   type SupplierOrderPaymentStatus,
   type SupplierOrderShippingMethod,
   type SupplierOrderSortBy,
   type SupplierOrderTransitionStatus,
};

export const SUPPLIER_ORDER_SORT_ORDERS = {
   ASC: 'ASC',
   DESC: 'DESC',
} as const;

export type SupplierOrderSortOrder = (typeof SUPPLIER_ORDER_SORT_ORDERS)[keyof typeof SUPPLIER_ORDER_SORT_ORDERS];

export class ListSupplierOrdersQueryDto {
   @ApiPropertyOptional({
      description: 'Current page number index (1-based)',
      example: 1,
      default: 1,
      minimum: 1,
   })
   @IsOptional()
   @Type(() => Number)
   @IsInt()
   @Min(1)
   page?: number = 1;

   @ApiPropertyOptional({
      description: 'Maximum number of order records per page',
      example: 20,
      default: 20,
      minimum: 1,
      maximum: 100,
   })
   @IsOptional()
   @Type(() => Number)
   @IsInt()
   @Min(1)
   @Max(100)
   limit?: number = 20;

   @ApiPropertyOptional({
      description: 'Order status group filter (e.g. shipping or needs_action)',
      enum: SUPPLIER_ORDER_GROUPS,
      example: 'needs_action',
   })
   @IsOptional()
   @IsString()
   @IsIn(Object.values(SUPPLIER_ORDER_GROUPS))
   group?: SupplierOrderGroup;

   @ApiPropertyOptional({
      description: 'Exact lifecycle status of the order',
      enum: ORDER_STATUS,
      example: 'PROCESSING',
   })
   @IsOptional()
   @IsEnum(ORDER_STATUS)
   status?: OrderStatus;

   @ApiPropertyOptional({
      description: 'Time window filter preset shortcut',
      enum: SUPPLIER_ORDER_DATE_RANGES,
      default: 'ALL',
      example: 'TODAY',
   })
   @IsOptional()
   @IsString()
   dateRange?: SupplierOrderDateRange = 'ALL';

   @ApiPropertyOptional({
      description: 'Custom filter start datetime in ISO-8601 format',
      example: '2026-10-20T00:00:00.000Z',
   })
   @IsOptional()
   @IsString()
   startDate?: string;

   @ApiPropertyOptional({
      description: 'Custom filter end datetime in ISO-8601 format',
      example: '2026-10-27T23:59:59.000Z',
   })
   @IsOptional()
   @IsString()
   endDate?: string;

   @ApiPropertyOptional({
      description: 'Shipping delivery method filter',
      enum: SUPPLIER_ORDER_SHIPPING_METHODS,
      default: 'ALL',
      example: 'DELIVERY',
   })
   @IsOptional()
   @IsString()
   shippingMethod?: SupplierOrderShippingMethod = 'ALL';

   @ApiPropertyOptional({
      description: 'Payment status or settlement method filter',
      enum: SUPPLIER_ORDER_PAYMENT_STATUSES,
      default: 'ALL',
      example: 'PAID',
   })
   @IsOptional()
   @IsString()
   paymentStatus?: SupplierOrderPaymentStatus = 'ALL';

   @ApiPropertyOptional({
      description: 'Fuzzy text search keyword matching order number, recipient name, recipient phone, or product name',
      example: 'ORD-9842',
   })
   @IsOptional()
   @IsString()
   search?: string;

   @ApiPropertyOptional({
      description: 'Property field to sort results by',
      enum: SUPPLIER_ORDER_SORT_BY,
      default: 'createdAt',
      example: 'createdAt',
   })
   @IsOptional()
   @IsString()
   sortBy?: SupplierOrderSortBy = 'createdAt';

   @ApiPropertyOptional({
      description: 'Sort direction sequence',
      enum: SUPPLIER_ORDER_SORT_ORDERS,
      default: 'DESC',
      example: 'DESC',
   })
   @IsOptional()
   @IsString()
   sortOrder?: SupplierOrderSortOrder = 'DESC';
}

export class SupplierOrderItemDto {
   @ApiProperty({ description: 'Explicit UUID of the order item record', example: 'item-001' })
   orderItemId!: string;

   @ApiProperty({ description: 'Convenience alias matching client contract id', example: 'item-001' })
   id!: string;

   @ApiProperty({ description: 'UUID of the product offer', example: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22' })
   productId!: string;

   @ApiProperty({ description: 'Product title / name', example: 'Cơm tấm sườn nướng đặc biệt' })
   title!: string;

   @ApiProperty({ description: 'Quantity ordered', example: 2 })
   quantity!: number;

   @ApiProperty({ description: 'Unit item price', example: 55000 })
   price!: number;

   @ApiProperty({ description: 'Calculated line item total price', example: 110000 })
   totalPrice!: number;

   @ApiPropertyOptional({
      description: 'Thumbnail / image URL of the product offer',
      example: 'https://cdn.omniservices.com/products/com-tam.jpg',
   })
   imageUrl?: string;
}

export class SupplierOrderSummaryDto {
   @ApiProperty({
      description: 'Count of active orders in shipping/transit state (SHIPPING, DELIVERED)',
      example: 15,
   })
   shippingCount!: number;

   @ApiProperty({
      description: 'Count of pending orders requiring immediate merchant action (PENDING, CONFIRMED, PROCESSING)',
      example: 5,
   })
   needsActionCount!: number;
}

export class SupplierOrderPaginationDto {
   @ApiProperty({ description: 'Current page number', example: 1 })
   page!: number;

   @ApiProperty({ description: 'Page record size limit', example: 20 })
   limit!: number;

   @ApiProperty({ description: 'Total number of items matching filters', example: 42 })
   totalItems!: number;

   @ApiProperty({ description: 'Total calculated number of pages', example: 3 })
   totalPages!: number;
}

export class SupplierOrderListItemDto {
   @ApiProperty({ description: 'Explicit UUID of the order', example: 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a33' })
   orderId!: string;

   @ApiProperty({
      description: 'Convenience alias matching client contract id',
      example: 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
   })
   id!: string;

   @ApiProperty({ description: 'Human-readable unique order tracking number', example: 'ORD-9842' })
   orderNumber!: string;

   @ApiProperty({ description: 'Customer recipient name', example: 'Nguyễn Văn An' })
   customerName!: string;

   @ApiProperty({ description: 'Customer contact phone number', example: '0901234567' })
   customerPhone!: string;

   @ApiProperty({
      description: 'Delivery destination street address',
      example: 'Phòng 402, Toà S1.02 Vinhomes Grand Park, TP. Thủ Đức',
   })
   deliveryAddress!: string;

   @ApiProperty({ description: 'Fulfillment method (DELIVERY or PICKUP)', example: 'DELIVERY' })
   shippingMethod!: string;

   @ApiProperty({ description: 'Total order value payable', example: 145000 })
   totalAmount!: number;

   @ApiProperty({ description: 'Shipping delivery fee charged', example: 15000 })
   shippingFee!: number;

   @ApiProperty({ description: 'Current lifecycle status of the order', example: 'PROCESSING' })
   status!: string;

   @ApiProperty({ description: 'Payment method chosen (COD, CREDIT_CARD, MOMO, VNPAY)', example: 'COD' })
   paymentMethod!: string;

   @ApiProperty({ description: 'Payment financial status (PENDING, SUCCESS, FAILED)', example: 'PENDING' })
   paymentStatus!: string;

   @ApiPropertyOptional({ description: 'Customer order instruction note', example: 'Giao giờ hành chính' })
   note?: string;

   @ApiProperty({ description: 'Order creation timestamp in ISO format', example: '2026-10-27T10:30:00.000Z' })
   createdAt!: string;

   @ApiProperty({ description: 'Order last updated timestamp in ISO format', example: '2026-10-27T10:35:00.000Z' })
   updatedAt!: string;

   @ApiProperty({ type: [SupplierOrderItemDto], description: 'Purchased product line items' })
   items!: SupplierOrderItemDto[];
}

export class SupplierOrderListResponseDto {
   @ApiProperty({ type: [SupplierOrderListItemDto], description: 'List of supplier store orders' })
   items!: SupplierOrderListItemDto[];

   @ApiProperty({ type: SupplierOrderPaginationDto, description: 'Pagination metadata' })
   pagination!: SupplierOrderPaginationDto;

   @ApiProperty({ type: SupplierOrderSummaryDto, description: 'Action badge summary count' })
   summary!: SupplierOrderSummaryDto;
}

export class CustomerDetailDto {
   @ApiProperty({ description: 'User account UUID', example: 'user-uuid-123' })
   userId!: string;

   @ApiProperty({ description: 'Customer display name', example: 'Nguyễn Văn An' })
   name!: string;

   @ApiProperty({ description: 'Customer contact phone', example: '0901234567' })
   phone!: string;

   @ApiPropertyOptional({
      description: 'Customer avatar image URL',
      example: 'https://cdn.omniservices.com/avatars/user.jpg',
   })
   avatar?: string;
}

export class OrderTimelineItemDto {
   @ApiProperty({ description: 'Lifecycle status milestone reached', example: 'CONFIRMED' })
   status!: string;

   @ApiProperty({ description: 'Milestone event timestamp in ISO format', example: '2026-10-27T10:32:00.000Z' })
   time!: string;

   @ApiProperty({
      description: 'Human-readable description of the progress milestone',
      example: 'Người bán đã xác nhận đơn hàng',
   })
   description!: string;
}

export class SupplierOrderDetailDto {
   @ApiProperty({ description: 'Explicit UUID of the order', example: 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a33' })
   orderId!: string;

   @ApiProperty({
      description: 'Convenience alias matching client contract id',
      example: 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
   })
   id!: string;

   @ApiProperty({ description: 'Human-readable order tracking number', example: 'ORD-9842' })
   orderNumber!: string;

   @ApiProperty({ type: CustomerDetailDto, description: 'Purchasing customer information' })
   customer!: CustomerDetailDto;

   @ApiProperty({
      description: 'Delivery destination address',
      example: 'Phòng 402, Toà S1.02 Vinhomes Grand Park, TP. Thủ Đức',
   })
   shippingAddress!: string;

   @ApiProperty({ description: 'Fulfillment shipping method', example: 'DELIVERY' })
   shippingMethod!: string;

   @ApiProperty({ description: 'Order lifecycle status', example: 'PROCESSING' })
   status!: string;

   @ApiProperty({ description: 'Payment method chosen', example: 'COD' })
   paymentMethod!: string;

   @ApiProperty({ description: 'Payment processing status', example: 'PENDING' })
   paymentStatus!: string;

   @ApiProperty({ description: 'Total payable financial amount', example: 145000 })
   totalAmount!: number;

   @ApiProperty({ description: 'Subtotal item amount before shipping and discounts', example: 130000 })
   subTotal!: number;

   @ApiProperty({ description: 'Shipping delivery fee charged', example: 15000 })
   shippingFee!: number;

   @ApiProperty({ description: 'Discount promotion amount applied', example: 0 })
   discountAmount!: number;

   @ApiPropertyOptional({ description: 'Customer note', example: 'Cho nhiều nước mắm' })
   note?: string;

   @ApiProperty({ type: [SupplierOrderItemDto], description: 'Ordered product line items' })
   items!: SupplierOrderItemDto[];

   @ApiProperty({ type: [OrderTimelineItemDto], description: 'Order milestone progression timeline' })
   timeline!: OrderTimelineItemDto[];

   @ApiProperty({ description: 'Order creation timestamp', example: '2026-10-27T10:30:00.000Z' })
   createdAt!: string;

   @ApiProperty({ description: 'Order last update timestamp', example: '2026-10-27T10:32:00.000Z' })
   updatedAt!: string;
}

export class UpdateSupplierOrderStatusDto {
   @ApiProperty({
      description: 'Target operational status for the order',
      enum: SUPPLIER_ORDER_TRANSITION_STATUSES,
      example: ORDER_STATUS.CONFIRMED,
   })
   @IsNotEmpty()
   @IsString()
   @IsIn(SUPPLIER_ORDER_TRANSITION_STATUSES)
   status!: SupplierOrderTransitionStatus;

   @ApiPropertyOptional({
      description: 'Reason for cancellation, rejection, or merchant processing notes',
      example: 'Xác nhận nhận đơn và chuẩn bị hàng',
   })
   @IsOptional()
   @IsString()
   reason?: string;

   @ApiPropertyOptional({
      description: 'Logistics shipping tracking waybill code (when handed over to delivery partner)',
      example: 'GHN-128391823',
   })
   @IsOptional()
   @IsString()
   shipperTrackingCode?: string;
}

export class UpdateSupplierOrderStatusResponseDto {
   @ApiProperty({ description: 'UUID of the updated order', example: 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a33' })
   orderId!: string;

   @ApiProperty({ description: 'Updated order status', example: 'CONFIRMED' })
   status!: string;

   @ApiProperty({ description: 'Update timestamp in ISO format', example: '2026-10-27T10:35:00.000Z' })
   updatedAt!: string;
}
