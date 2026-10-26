import { PRODUCT_EVENTS, ProductStockAdjustedEventPayload } from '@contracts/product';

export class StockAdjustedDomainEvent {
   static readonly EVENT_NAME = PRODUCT_EVENTS.STOCK_ADJUSTED;

   constructor(public readonly payload: ProductStockAdjustedEventPayload) {}
}
