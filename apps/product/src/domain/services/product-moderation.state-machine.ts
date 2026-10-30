import { BadRequestException } from '@common';
import {
   MODERATION_ACTION,
   MODERATION_STATUS,
   PRODUCT_ERROR_CODES,
   PRODUCT_FIELDS,
   PRODUCT_STATUS,
   type ModerationActionType,
   type ModerationStatusType,
   type ProductPendingEditData,
   type ProductStatusType,
} from '@contracts/product';

export interface StateTransitionResult {
   readonly action: ModerationActionType;
   readonly newModerationStatus: ModerationStatusType;
   readonly newProductStatus: ProductStatusType;
   readonly applyPendingEdit: boolean;
   readonly clearPendingEdit: boolean;
   readonly updatedFields?: ProductPendingEditData;
}

export class ProductModerationStateMachine {
   /**
    * Calculates the next state and required entity updates when an administrator moderates a product.
    */
   static transitionOnModeration(
      currentModerationStatus: ModerationStatusType,
      currentProductStatus: ProductStatusType,
      requestedStatus?: ModerationStatusType,
      requestedAction?: ModerationActionType,
      rejectionReason?: string,
      pendingEditData?: ProductPendingEditData | null,
   ): StateTransitionResult {
      // 1. Invariant: Rejection or Rejection of Edit requires a non-empty rejectionReason
      const isRejecting =
         requestedStatus === MODERATION_STATUS.REJECTED ||
         requestedAction === MODERATION_ACTION.REJECT ||
         requestedAction === MODERATION_ACTION.REJECT_EDIT;

      if (isRejecting && (!rejectionReason || !rejectionReason.trim())) {
         throw new BadRequestException(PRODUCT_ERROR_CODES.MODERATION_REJECTION_REASON_REQUIRED, {
            params: { field: PRODUCT_FIELDS.REJECTION_REASON },
         });
      }

      // 2. FSM Transitions based on currentModerationStatus
      switch (currentModerationStatus) {
         case MODERATION_STATUS.PENDING_APPROVAL: {
            if (requestedStatus === MODERATION_STATUS.APPROVED || requestedAction === MODERATION_ACTION.APPROVE) {
               return {
                  action: MODERATION_ACTION.APPROVE,
                  newModerationStatus: MODERATION_STATUS.APPROVED,
                  newProductStatus: PRODUCT_STATUS.ACTIVE,
                  applyPendingEdit: false,
                  clearPendingEdit: true,
               };
            }

            if (requestedStatus === MODERATION_STATUS.REJECTED || requestedAction === MODERATION_ACTION.REJECT) {
               return {
                  action: MODERATION_ACTION.REJECT,
                  newModerationStatus: MODERATION_STATUS.REJECTED,
                  newProductStatus: PRODUCT_STATUS.INACTIVE,
                  applyPendingEdit: false,
                  clearPendingEdit: true,
               };
            }

            break;
         }

         case MODERATION_STATUS.EDIT_PENDING_APPROVAL: {
            // Admin accepts the new draft edit
            if (
               requestedStatus === MODERATION_STATUS.APPROVED ||
               requestedAction === MODERATION_ACTION.APPROVE ||
               requestedAction === MODERATION_ACTION.APPROVE_EDIT
            ) {
               return {
                  action: MODERATION_ACTION.APPROVE_EDIT,
                  newModerationStatus: MODERATION_STATUS.APPROVED,
                  newProductStatus: PRODUCT_STATUS.ACTIVE,
                  applyPendingEdit: true,
                  clearPendingEdit: true,
                  updatedFields: pendingEditData || undefined,
               };
            }

            // Admin rejects the new draft edit: live version remains untouched and active
            if (
               requestedStatus === MODERATION_STATUS.REJECTED ||
               requestedAction === MODERATION_ACTION.REJECT ||
               requestedAction === MODERATION_ACTION.REJECT_EDIT
            ) {
               return {
                  action: MODERATION_ACTION.REJECT_EDIT,
                  newModerationStatus: MODERATION_STATUS.APPROVED,
                  newProductStatus: currentProductStatus,
                  applyPendingEdit: false,
                  clearPendingEdit: true,
               };
            }

            // Admin can also suspend the product if severe violations found in edit
            if (requestedStatus === MODERATION_STATUS.SUSPENDED || requestedAction === MODERATION_ACTION.SUSPEND) {
               return {
                  action: MODERATION_ACTION.SUSPEND,
                  newModerationStatus: MODERATION_STATUS.SUSPENDED,
                  newProductStatus: PRODUCT_STATUS.INACTIVE,
                  applyPendingEdit: false,
                  clearPendingEdit: true,
               };
            }

            break;
         }

         case MODERATION_STATUS.APPROVED: {
            if (requestedStatus === MODERATION_STATUS.SUSPENDED || requestedAction === MODERATION_ACTION.SUSPEND) {
               return {
                  action: MODERATION_ACTION.SUSPEND,
                  newModerationStatus: MODERATION_STATUS.SUSPENDED,
                  newProductStatus: PRODUCT_STATUS.INACTIVE,
                  applyPendingEdit: false,
                  clearPendingEdit: false,
               };
            }

            break;
         }

         case MODERATION_STATUS.SUSPENDED: {
            // Admin can reinstate a suspended product
            if (requestedStatus === MODERATION_STATUS.APPROVED || requestedAction === MODERATION_ACTION.APPROVE) {
               return {
                  action: MODERATION_ACTION.APPROVE,
                  newModerationStatus: MODERATION_STATUS.APPROVED,
                  newProductStatus: PRODUCT_STATUS.ACTIVE,
                  applyPendingEdit: false,
                  clearPendingEdit: false,
               };
            }

            break;
         }

         default:
            break;
      }

      // Invalid transition
      throw new BadRequestException(PRODUCT_ERROR_CODES.PRODUCT_INVALID_STATUS_TRANSITION, {
         params: {
            from: currentModerationStatus,
            to: requestedStatus,
         },
      });
   }

   /**
    * Validates and transitions product status when a supplier submits a product for review.
    */
   static transitionOnSubmitForReview(currentModerationStatus: ModerationStatusType): {
      newModerationStatus: ModerationStatusType;
   } {
      if (
         currentModerationStatus === MODERATION_STATUS.PENDING_APPROVAL ||
         currentModerationStatus === MODERATION_STATUS.EDIT_PENDING_APPROVAL
      ) {
         throw new BadRequestException(PRODUCT_ERROR_CODES.CANNOT_EDIT_WHILE_PENDING_APPROVAL, {
            params: { currentStatus: currentModerationStatus },
         });
      }

      if (
         currentModerationStatus === MODERATION_STATUS.DRAFT ||
         currentModerationStatus === MODERATION_STATUS.REJECTED
      ) {
         return {
            newModerationStatus: MODERATION_STATUS.PENDING_APPROVAL,
         };
      }

      throw new BadRequestException(PRODUCT_ERROR_CODES.PRODUCT_NOT_IN_REVIEWABLE_STATE, {
         params: { currentStatus: currentModerationStatus },
      });
   }
}
