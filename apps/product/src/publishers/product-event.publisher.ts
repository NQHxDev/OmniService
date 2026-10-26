import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SERVICES } from '@common';
import {
   PRODUCT_EVENTS,
   type ProductModeratedEventPayload,
   type ProductRegisteredEventPayload,
   type ProductStockAdjustedEventPayload,
} from '@contracts/product';
import type { IProductEventPublisher } from './product-event.publisher.interface';

@Injectable()
export class ProductEventPublisher implements IProductEventPublisher {
   private readonly logger = new Logger(ProductEventPublisher.name);

   constructor(
      @Inject(SERVICES.SEARCH_SERVICE)
      private readonly searchClient: ClientProxy,
      private readonly eventEmitter: EventEmitter2,
   ) {}

   publishProductRegistered(event: ProductRegisteredEventPayload): Promise<void> {
      try {
         // Emit directly to search-service queue for immediate indexing into Elasticsearch
         this.searchClient.emit(PRODUCT_EVENTS.REGISTERED, event);
         this.eventEmitter.emit(PRODUCT_EVENTS.REGISTERED, event);
         this.logger.log(`Published ${PRODUCT_EVENTS.REGISTERED} for product ${event.productId}`);
         return Promise.resolve();
      } catch (error) {
         this.logger.error(`Failed to publish ${PRODUCT_EVENTS.REGISTERED}: ${error}`);
         return Promise.resolve();
      }
   }

   publishProductApproved(event: ProductModeratedEventPayload): Promise<void> {
      try {
         this.searchClient.emit(PRODUCT_EVENTS.APPROVED, event);
         this.eventEmitter.emit(PRODUCT_EVENTS.APPROVED, event);
         this.logger.log(`Published ${PRODUCT_EVENTS.APPROVED} for product ${event.productId}`);
         return Promise.resolve();
      } catch (error) {
         this.logger.error(`Failed to publish ${PRODUCT_EVENTS.APPROVED}: ${error}`);
         return Promise.resolve();
      }
   }

   publishProductRejected(event: ProductModeratedEventPayload): Promise<void> {
      try {
         this.searchClient.emit(PRODUCT_EVENTS.REJECTED, event);
         this.eventEmitter.emit(PRODUCT_EVENTS.REJECTED, event);
         this.logger.log(`Published ${PRODUCT_EVENTS.REJECTED} for product ${event.productId}`);
         return Promise.resolve();
      } catch (error) {
         this.logger.error(`Failed to publish ${PRODUCT_EVENTS.REJECTED}: ${error}`);
         return Promise.resolve();
      }
   }

   publishProductStatusChanged(event: {
      productId: string;
      supplierId: string;
      status: string;
      updatedAt: string;
   }): Promise<void> {
      try {
         this.searchClient.emit(PRODUCT_EVENTS.STATUS_CHANGED, event);
         this.eventEmitter.emit(PRODUCT_EVENTS.STATUS_CHANGED, event);
         this.logger.log(`Published ${PRODUCT_EVENTS.STATUS_CHANGED} for product ${event.productId}`);
         return Promise.resolve();
      } catch (error) {
         this.logger.error(`Failed to publish ${PRODUCT_EVENTS.STATUS_CHANGED}: ${error}`);
         return Promise.resolve();
      }
   }

   publishStockAdjusted(event: ProductStockAdjustedEventPayload): Promise<void> {
      try {
         this.searchClient.emit(PRODUCT_EVENTS.STOCK_ADJUSTED, event);
         this.eventEmitter.emit(PRODUCT_EVENTS.STOCK_ADJUSTED, event);
         this.logger.log(`Published ${PRODUCT_EVENTS.STOCK_ADJUSTED} for variant ${event.variantId}`);
         return Promise.resolve();
      } catch (error) {
         this.logger.error(`Failed to publish ${PRODUCT_EVENTS.STOCK_ADJUSTED}: ${error}`);
         return Promise.resolve();
      }
   }
}
