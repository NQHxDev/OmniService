import { Injectable } from '@nestjs/common';
import {
   ORDER_ERROR_CODES,
   ORDER_STATUS,
   ORDER_TERMINAL_STATUSES,
   ORDER_TIMELINE_KEYS,
   type OrderErrorCode,
   type OrderStatus,
   type OrderTimelineKey,
} from '@contracts/order';

export interface TransitionValidationResult {
   isValid: boolean;
   errorCode?: OrderErrorCode;
   params?: Record<string, unknown>;
}

@Injectable()
export class OrderStateMachine {
   private readonly allowedTransitions: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
      [ORDER_STATUS.PENDING]: [ORDER_STATUS.CONFIRMED, ORDER_STATUS.CANCELLED],
      [ORDER_STATUS.AWAITING_PAYMENT]: [ORDER_STATUS.CONFIRMED, ORDER_STATUS.PROCESSING, ORDER_STATUS.CANCELLED],
      [ORDER_STATUS.CONFIRMED]: [ORDER_STATUS.PROCESSING, ORDER_STATUS.CANCELLED],
      [ORDER_STATUS.PROCESSING]: [ORDER_STATUS.SHIPPING, ORDER_STATUS.CANCELLED],
      [ORDER_STATUS.SHIPPING]: [ORDER_STATUS.DELIVERED, ORDER_STATUS.COMPLETED, ORDER_STATUS.CANCELLED],
      [ORDER_STATUS.DELIVERED]: [ORDER_STATUS.COMPLETED, ORDER_STATUS.CANCELLED, ORDER_STATUS.REFUNDED],
      [ORDER_STATUS.COMPLETED]: [],
      [ORDER_STATUS.CANCELLED]: [],
      [ORDER_STATUS.REFUNDED]: [],
   };

   private readonly statusTimelineKeys: Readonly<Record<OrderStatus, OrderTimelineKey>> = {
      [ORDER_STATUS.PENDING]: ORDER_TIMELINE_KEYS.ORDER_CREATED,
      [ORDER_STATUS.AWAITING_PAYMENT]: ORDER_TIMELINE_KEYS.AWAITING_PAYMENT,
      [ORDER_STATUS.CONFIRMED]: ORDER_TIMELINE_KEYS.CONFIRMED,
      [ORDER_STATUS.PROCESSING]: ORDER_TIMELINE_KEYS.PROCESSING,
      [ORDER_STATUS.SHIPPING]: ORDER_TIMELINE_KEYS.SHIPPING,
      [ORDER_STATUS.DELIVERED]: ORDER_TIMELINE_KEYS.DELIVERED,
      [ORDER_STATUS.COMPLETED]: ORDER_TIMELINE_KEYS.COMPLETED,
      [ORDER_STATUS.CANCELLED]: ORDER_TIMELINE_KEYS.CANCELLED,
      [ORDER_STATUS.REFUNDED]: ORDER_TIMELINE_KEYS.REFUNDED,
   };

   canTransition(currentStatus: OrderStatus, targetStatus: OrderStatus): boolean {
      const allowed = this.allowedTransitions[currentStatus] || [];
      return allowed.includes(targetStatus);
   }

   validateTransition(currentStatus: OrderStatus, targetStatus: OrderStatus): TransitionValidationResult {
      if (currentStatus === targetStatus) {
         return {
            isValid: false,
            errorCode: ORDER_ERROR_CODES.ORDER_ALREADY_IN_STATUS,
            params: { currentStatus, targetStatus },
         };
      }

      if (ORDER_TERMINAL_STATUSES.includes(currentStatus)) {
         return {
            isValid: false,
            errorCode: ORDER_ERROR_CODES.CANNOT_TRANSITION_TERMINAL_STATUS,
            params: { currentStatus, targetStatus },
         };
      }

      const allowed = this.allowedTransitions[currentStatus] || [];
      if (!allowed.includes(targetStatus)) {
         return {
            isValid: false,
            errorCode: ORDER_ERROR_CODES.INVALID_STATUS_TRANSITION,
            params: {
               currentStatus,
               targetStatus,
               allowedStatuses: allowed,
            },
         };
      }

      return { isValid: true };
   }

   getTimelineKey(status: OrderStatus): OrderTimelineKey {
      return this.statusTimelineKeys[status] || ORDER_TIMELINE_KEYS.ORDER_CREATED;
   }
}
