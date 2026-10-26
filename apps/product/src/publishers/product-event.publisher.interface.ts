import {
   ProductModeratedEventPayload,
   ProductRegisteredEventPayload,
   ProductStockAdjustedEventPayload,
} from '@contracts/product';

export const PRODUCT_EVENT_PUBLISHER = Symbol('PRODUCT_EVENT_PUBLISHER');

export interface IProductEventPublisher {
   publishProductRegistered(event: ProductRegisteredEventPayload): Promise<void>;
   publishProductApproved(event: ProductModeratedEventPayload): Promise<void>;
   publishProductRejected(event: ProductModeratedEventPayload): Promise<void>;
   publishProductStatusChanged(event: {
      productId: string;
      supplierId: string;
      status: string;
      updatedAt: string;
   }): Promise<void>;
   publishStockAdjusted(event: ProductStockAdjustedEventPayload): Promise<void>;
}
