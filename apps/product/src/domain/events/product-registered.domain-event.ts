import { PRODUCT_EVENTS, ProductRegisteredEventPayload } from '@contracts/product';

export class ProductRegisteredDomainEvent {
   static readonly EVENT_NAME = PRODUCT_EVENTS.REGISTERED;

   constructor(public readonly payload: ProductRegisteredEventPayload) {}
}
