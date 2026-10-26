import { PRODUCT_EVENTS } from '@contracts/product';

export class ProductStatusUpdatedDomainEvent {
   static readonly EVENT_NAME = PRODUCT_EVENTS.STATUS_CHANGED;

   constructor(
      public readonly payload: {
         productId: string;
         supplierId: string;
         status: string;
         updatedAt: string;
      },
   ) {}
}
