import {
   ORDER_STATUS,
   type OrderStatus,
   PAYMENT_METHODS,
   PAYMENT_STATUS,
} from '@contracts/order/constants/order-status.constant';

export const FILTER_ALL = 'ALL' as const;

export const SUPPLIER_ORDER_GROUPS = {
   SHIPPING: 'shipping',
   NEEDS_ACTION: 'needs_action',
} as const;

export type SupplierOrderGroup = (typeof SUPPLIER_ORDER_GROUPS)[keyof typeof SUPPLIER_ORDER_GROUPS];

export const SUPPLIER_ORDER_GROUP_STATUSES: Readonly<Record<SupplierOrderGroup, readonly OrderStatus[]>> = {
   [SUPPLIER_ORDER_GROUPS.SHIPPING]: [ORDER_STATUS.SHIPPING, ORDER_STATUS.DELIVERED],
   [SUPPLIER_ORDER_GROUPS.NEEDS_ACTION]: [
      ORDER_STATUS.PENDING,
      ORDER_STATUS.AWAITING_PAYMENT,
      ORDER_STATUS.CONFIRMED,
      ORDER_STATUS.PROCESSING,
   ],
};

export const SUPPLIER_ORDER_DATE_RANGES = {
   ALL: 'ALL',
   TODAY: 'TODAY',
   YESTERDAY: 'YESTERDAY',
   LAST_7_DAYS: 'LAST_7_DAYS',
   THIS_MONTH: 'THIS_MONTH',
} as const;

export type SupplierOrderDateRange = (typeof SUPPLIER_ORDER_DATE_RANGES)[keyof typeof SUPPLIER_ORDER_DATE_RANGES];

export const SUPPLIER_ORDER_SHIPPING_METHODS = {
   ALL: 'ALL',
   DELIVERY: 'DELIVERY',
   PICKUP: 'PICKUP',
} as const;

export type SupplierOrderShippingMethod =
   (typeof SUPPLIER_ORDER_SHIPPING_METHODS)[keyof typeof SUPPLIER_ORDER_SHIPPING_METHODS];

export const SUPPLIER_ORDER_PAYMENT_STATUSES = {
   ALL: 'ALL',
   PAID: 'PAID',
   SUCCESS: PAYMENT_STATUS.SUCCESS,
   UNPAID: 'UNPAID',
   PENDING: PAYMENT_STATUS.PENDING,
   COD: PAYMENT_METHODS.COD,
} as const;

export type SupplierOrderPaymentStatus =
   (typeof SUPPLIER_ORDER_PAYMENT_STATUSES)[keyof typeof SUPPLIER_ORDER_PAYMENT_STATUSES];

export const SUPPLIER_ORDER_SORT_BY = {
   CREATED_AT: 'createdAt',
   TOTAL_AMOUNT: 'totalAmount',
} as const;

export type SupplierOrderSortBy = (typeof SUPPLIER_ORDER_SORT_BY)[keyof typeof SUPPLIER_ORDER_SORT_BY];

export const SUPPLIER_ORDER_TRANSITION_STATUSES = [
   ORDER_STATUS.CONFIRMED,
   ORDER_STATUS.PROCESSING,
   ORDER_STATUS.SHIPPING,
   ORDER_STATUS.COMPLETED,
   ORDER_STATUS.CANCELLED,
] as const;

export type SupplierOrderTransitionStatus = (typeof SUPPLIER_ORDER_TRANSITION_STATUSES)[number];
