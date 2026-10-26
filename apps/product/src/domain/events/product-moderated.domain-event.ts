import { PRODUCT_EVENTS, ProductModeratedEventPayload } from '@contracts/product';

export class ProductModeratedDomainEvent {
   static readonly EVENT_NAME = PRODUCT_EVENTS.APPROVED;

   constructor(public readonly payload: ProductModeratedEventPayload) {}
}
