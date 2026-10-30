import { ORDER_ERROR_CODES, ORDER_STATUS, ORDER_TIMELINE_KEYS } from '@contracts/order';
import { OrderStateMachine } from '@order/services/order-state-machine.service';

describe('OrderStateMachine', () => {
   let stateMachine: OrderStateMachine;

   beforeEach(() => {
      stateMachine = new OrderStateMachine();
   });

   describe('validateTransition', () => {
      it('should allow transition from CONFIRMED to SHIPPING', () => {
         const result = stateMachine.validateTransition(ORDER_STATUS.CONFIRMED, ORDER_STATUS.SHIPPING);
         expect(result.isValid).toBe(true);
      });

      it('should allow transition from CONFIRMED to PROCESSING', () => {
         const result = stateMachine.validateTransition(ORDER_STATUS.CONFIRMED, ORDER_STATUS.PROCESSING);
         expect(result.isValid).toBe(true);
      });

      it('should allow transition from CONFIRMED to CANCELLED', () => {
         const result = stateMachine.validateTransition(ORDER_STATUS.CONFIRMED, ORDER_STATUS.CANCELLED);
         expect(result.isValid).toBe(true);
      });

      it('should allow transition from PROCESSING to SHIPPING', () => {
         const result = stateMachine.validateTransition(ORDER_STATUS.PROCESSING, ORDER_STATUS.SHIPPING);
         expect(result.isValid).toBe(true);
      });

      it('should allow transition from PROCESSING to COMPLETED', () => {
         const result = stateMachine.validateTransition(ORDER_STATUS.PROCESSING, ORDER_STATUS.COMPLETED);
         expect(result.isValid).toBe(true);
      });

      it('should allow transition from SHIPPING to DELIVERED', () => {
         const result = stateMachine.validateTransition(ORDER_STATUS.SHIPPING, ORDER_STATUS.DELIVERED);
         expect(result.isValid).toBe(true);
      });

      it('should allow transition from SHIPPING to COMPLETED', () => {
         const result = stateMachine.validateTransition(ORDER_STATUS.SHIPPING, ORDER_STATUS.COMPLETED);
         expect(result.isValid).toBe(true);
      });

      it('should allow transition from PENDING to CONFIRMED or PROCESSING', () => {
         expect(stateMachine.validateTransition(ORDER_STATUS.PENDING, ORDER_STATUS.CONFIRMED).isValid).toBe(true);
         expect(stateMachine.validateTransition(ORDER_STATUS.PENDING, ORDER_STATUS.PROCESSING).isValid).toBe(true);
      });

      it('should reject transition when current and target status are identical', () => {
         const result = stateMachine.validateTransition(ORDER_STATUS.CONFIRMED, ORDER_STATUS.CONFIRMED);
         expect(result.isValid).toBe(false);
         expect(result.errorCode).toBe(ORDER_ERROR_CODES.ORDER_ALREADY_IN_STATUS);
         expect(result.params).toEqual({
            currentStatus: ORDER_STATUS.CONFIRMED,
            targetStatus: ORDER_STATUS.CONFIRMED,
         });
      });

      it('should reject transition when current status is terminal (COMPLETED, CANCELLED, REFUNDED)', () => {
         const terminalStatuses = [ORDER_STATUS.COMPLETED, ORDER_STATUS.CANCELLED, ORDER_STATUS.REFUNDED];
         for (const status of terminalStatuses) {
            const result = stateMachine.validateTransition(status, ORDER_STATUS.SHIPPING);
            expect(result.isValid).toBe(false);
            expect(result.errorCode).toBe(ORDER_ERROR_CODES.CANNOT_TRANSITION_TERMINAL_STATUS);
         }
      });

      it('should reject invalid transition and provide allowedStatuses in params', () => {
         const result = stateMachine.validateTransition(ORDER_STATUS.CONFIRMED, ORDER_STATUS.DELIVERED);
         expect(result.isValid).toBe(false);
         expect(result.errorCode).toBe(ORDER_ERROR_CODES.INVALID_STATUS_TRANSITION);
         expect(result.params).toEqual({
            currentStatus: ORDER_STATUS.CONFIRMED,
            targetStatus: ORDER_STATUS.DELIVERED,
            allowedStatuses: [ORDER_STATUS.PROCESSING, ORDER_STATUS.SHIPPING, ORDER_STATUS.CANCELLED],
         });
      });
   });

   describe('canTransition', () => {
      it('should return true for valid transitions and false for invalid ones', () => {
         expect(stateMachine.canTransition(ORDER_STATUS.CONFIRMED, ORDER_STATUS.SHIPPING)).toBe(true);
         expect(stateMachine.canTransition(ORDER_STATUS.CONFIRMED, ORDER_STATUS.DELIVERED)).toBe(false);
      });
   });

   describe('getTimelineKey', () => {
      it('should return correct timeline key for each status', () => {
         expect(stateMachine.getTimelineKey(ORDER_STATUS.CONFIRMED)).toBe(ORDER_TIMELINE_KEYS.CONFIRMED);
         expect(stateMachine.getTimelineKey(ORDER_STATUS.SHIPPING)).toBe(ORDER_TIMELINE_KEYS.SHIPPING);
         expect(stateMachine.getTimelineKey(ORDER_STATUS.DELIVERED)).toBe(ORDER_TIMELINE_KEYS.DELIVERED);
         expect(stateMachine.getTimelineKey(ORDER_STATUS.COMPLETED)).toBe(ORDER_TIMELINE_KEYS.COMPLETED);
         expect(stateMachine.getTimelineKey(ORDER_STATUS.CANCELLED)).toBe(ORDER_TIMELINE_KEYS.CANCELLED);
      });
   });
});
