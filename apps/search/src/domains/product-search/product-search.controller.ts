import { Controller } from '@nestjs/common';
import { Ctx, EventPattern, MessagePattern, Payload, RmqContext } from '@nestjs/microservices';
import { AppLogger, QUEUES, RmqService } from '@common';
import { CURRENCY, MODERATION_STATUS, PRODUCT_EVENTS, PRODUCT_STATUS } from '@contracts/product';
import { BULK_OPERATIONS, SEARCH_INDICES, SEARCH_PATTERNS } from '@contracts/search';
import { BulkIndexQueue } from '@search/core/queue';
import {
   ProductSearchService,
   type ProductVariantDocument,
   type SearchProductsParams,
} from '@search/domains/product-search/product-search.service';

@Controller()
export class ProductSearchController {
   constructor(
      private readonly productSearchService: ProductSearchService,
      private readonly bulkQueue: BulkIndexQueue,
      private readonly rmqService: RmqService,
      private readonly logger: AppLogger,
   ) {
      this.logger.setContext(ProductSearchController.name);
   }

   @EventPattern(PRODUCT_EVENTS.REGISTERED)
   async handleProductRegistered(@Payload() data: Record<string, unknown>, @Ctx() context?: RmqContext): Promise<void> {
      try {
         const productId = data.productId as string;
         this.logger.log(`Received ${PRODUCT_EVENTS.REGISTERED} event for ${productId}`);

         const variants = (data.variants as ProductVariantDocument[]) || [];
         const prices = variants.map((v) => v.price).filter((p) => typeof p === 'number' && !isNaN(p));
         const minPrice = prices.length > 0 ? Math.min(...prices) : undefined;
         const maxPrice = prices.length > 0 ? Math.max(...prices) : undefined;
         const currency = variants[0]?.currency || CURRENCY.VND;

         await this.bulkQueue.addOperation({
            operation: BULK_OPERATIONS.INDEX,
            index: SEARCH_INDICES.PRODUCTS,
            documentId: productId,
            data: {
               productId,
               supplierId: data.supplierId,
               whoCategoryCode: data.whoCategoryCode,
               productName: data.productName,
               productSlug: data.productSlug,
               description: data.description,
               origin: data.origin,
               storageCondition: data.storageCondition,
               shelfLifeDays: data.shelfLifeDays,
               images: data.images || [],
               status: data.status,
               moderationStatus: data.moderationStatus,
               variants,
               minPrice,
               maxPrice,
               currency,
               createdAt: data.createdAt ? new Date(data.createdAt as string) : new Date(),
               updatedAt: new Date(),
            },
         });

         if (context) {
            this.rmqService.ack(context);
         }
      } catch (error) {
         this.logger.error(
            `Error queuing ${PRODUCT_EVENTS.REGISTERED}`,
            error instanceof Error ? error.stack : undefined,
         );
         await this.rmqService.handleError(error, context, { queue: QUEUES.SEARCH });
      }
   }

   @EventPattern(PRODUCT_EVENTS.APPROVED)
   async handleProductApproved(@Payload() data: Record<string, unknown>, @Ctx() context?: RmqContext): Promise<void> {
      try {
         const productId = data.productId as string;
         this.logger.log(`Received ${PRODUCT_EVENTS.APPROVED} event for ${productId}`);
         await this.bulkQueue.addOperation({
            operation: BULK_OPERATIONS.UPDATE,
            index: SEARCH_INDICES.PRODUCTS,
            documentId: productId,
            data: {
               doc: {
                  moderationStatus: data.moderationStatus ?? MODERATION_STATUS.APPROVED,
                  status: PRODUCT_STATUS.ACTIVE,
                  moderatedBy: data.moderatedBy,
                  moderatedAt: data.moderatedAt,
                  updatedAt: new Date(),
               },
            },
         });
         if (context) {
            this.rmqService.ack(context);
         }
      } catch (error) {
         this.logger.error(
            `Error queuing ${PRODUCT_EVENTS.APPROVED}`,
            error instanceof Error ? error.stack : undefined,
         );
         await this.rmqService.handleError(error, context, { queue: QUEUES.SEARCH });
      }
   }

   @EventPattern(PRODUCT_EVENTS.REJECTED)
   async handleProductRejected(@Payload() data: Record<string, unknown>, @Ctx() context?: RmqContext): Promise<void> {
      try {
         const productId = data.productId as string;
         this.logger.log(`Received ${PRODUCT_EVENTS.REJECTED} event for ${productId}`);
         await this.bulkQueue.addOperation({
            operation: BULK_OPERATIONS.UPDATE,
            index: SEARCH_INDICES.PRODUCTS,
            documentId: productId,
            data: {
               doc: {
                  moderationStatus: data.moderationStatus ?? MODERATION_STATUS.REJECTED,
                  status: PRODUCT_STATUS.DRAFT,
                  rejectionReason: data.rejectionReason,
                  moderatedBy: data.moderatedBy,
                  moderatedAt: data.moderatedAt,
                  updatedAt: new Date(),
               },
            },
         });
         if (context) {
            this.rmqService.ack(context);
         }
      } catch (error) {
         this.logger.error(
            `Error queuing ${PRODUCT_EVENTS.REJECTED}`,
            error instanceof Error ? error.stack : undefined,
         );
         await this.rmqService.handleError(error, context, { queue: QUEUES.SEARCH });
      }
   }

   @EventPattern(PRODUCT_EVENTS.STATUS_CHANGED)
   async handleProductStatusChanged(
      @Payload() data: Record<string, unknown>,
      @Ctx() context?: RmqContext,
   ): Promise<void> {
      try {
         const productId = data.productId as string;
         this.logger.log(`Received ${PRODUCT_EVENTS.STATUS_CHANGED} event for ${productId}`);
         await this.bulkQueue.addOperation({
            operation: BULK_OPERATIONS.UPDATE,
            index: SEARCH_INDICES.PRODUCTS,
            documentId: productId,
            data: {
               doc: {
                  status: data.status,
                  updatedAt: new Date(),
               },
            },
         });
         if (context) {
            this.rmqService.ack(context);
         }
      } catch (error) {
         this.logger.error(
            `Error queuing ${PRODUCT_EVENTS.STATUS_CHANGED}`,
            error instanceof Error ? error.stack : undefined,
         );
         await this.rmqService.handleError(error, context, { queue: QUEUES.SEARCH });
      }
   }

   @MessagePattern({ cmd: SEARCH_PATTERNS.SEARCH_PRODUCTS })
   async searchProducts(@Payload() data: SearchProductsParams, @Ctx() context?: RmqContext) {
      try {
         const result = await this.productSearchService.searchProducts(data);
         if (context) {
            this.rmqService.ack(context);
         }
         return result;
      } catch (error) {
         await this.rmqService.handleError(error, context, { queue: QUEUES.SEARCH });
         throw error;
      }
   }

   @MessagePattern({ cmd: SEARCH_PATTERNS.SUGGEST_PRODUCTS })
   async suggestProducts(@Payload() data: { query: string; limit?: number }, @Ctx() context?: RmqContext) {
      try {
         const result = await this.productSearchService.suggestProducts(data);
         if (context) {
            this.rmqService.ack(context);
         }
         return result;
      } catch (error) {
         await this.rmqService.handleError(error, context, { queue: QUEUES.SEARCH });
         throw error;
      }
   }
}
