import { Controller } from '@nestjs/common';
import { Ctx, EventPattern, MessagePattern, Payload, RmqContext } from '@nestjs/microservices';
import { AppLogger, QUEUES, RmqService } from '@common';
import {
   COMMERCE_EVENTS,
   CurrencyEnum,
   IngredientStatusEnum,
   type IngredientDeletedPayload,
   type IngredientEventPayload,
} from '@contracts/commerce';
import { BULK_OPERATIONS, SEARCH_INDICES, SEARCH_PATTERNS } from '@contracts/search';
import { BulkIndexQueue } from '@search/core/queue';
import {
   IngredientSearchService,
   type SearchIngredientsParams,
} from '@search/domains/ingredient-search/ingredient-search.service';

@Controller()
export class IngredientSearchController {
   constructor(
      private readonly ingredientSearchService: IngredientSearchService,
      private readonly bulkQueue: BulkIndexQueue,
      private readonly rmqService: RmqService,
      private readonly logger: AppLogger,
   ) {
      this.logger.setContext(IngredientSearchController.name);
   }

   @EventPattern(COMMERCE_EVENTS.INGREDIENT_CREATED)
   async handleIngredientCreated(@Payload() data: IngredientEventPayload, @Ctx() context?: RmqContext): Promise<void> {
      try {
         this.logger.log(`Received ${COMMERCE_EVENTS.INGREDIENT_CREATED} event for ${data.ingredientId}`);
         await this.bulkQueue.addOperation({
            operation: BULK_OPERATIONS.INDEX,
            index: SEARCH_INDICES.INGREDIENTS,
            documentId: data.ingredientId,
            data: {
               ingredientId: data.ingredientId,
               ingredientName: data.ingredientName,
               normalizedName: data.normalizedName,
               ingredientSlug: data.ingredientSlug,
               ingredientDescription: data.ingredientDescription,
               ingredientImageUrl: data.ingredientImageUrl,
               categoryId: data.categoryId,
               categoryName: data.categoryName,
               defaultUnit: data.defaultUnit,
               ingredientStatus: data.ingredientStatus ?? IngredientStatusEnum.ACTIVE,
               supplierCount: data.supplierCount ?? 0,
               minPrice: data.minPrice ?? 0,
               maxPrice: data.maxPrice ?? 0,
               currency: data.currency ?? CurrencyEnum.VND,
               createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
               updatedAt: data.updatedAt ? new Date(data.updatedAt) : new Date(),
            },
         });
         if (context) {
            this.rmqService.ack(context);
         }
      } catch (error) {
         this.logger.error(
            `Error queuing ${COMMERCE_EVENTS.INGREDIENT_CREATED}`,
            error instanceof Error ? error.stack : undefined,
         );
         await this.rmqService.handleError(error, context, { queue: QUEUES.SEARCH });
      }
   }

   @EventPattern(COMMERCE_EVENTS.INGREDIENT_UPDATED)
   async handleIngredientUpdated(@Payload() data: IngredientEventPayload, @Ctx() context?: RmqContext): Promise<void> {
      try {
         this.logger.log(`Received ${COMMERCE_EVENTS.INGREDIENT_UPDATED} event for ${data.ingredientId}`);
         await this.bulkQueue.addOperation({
            operation: BULK_OPERATIONS.UPDATE,
            index: SEARCH_INDICES.INGREDIENTS,
            documentId: data.ingredientId,
            data: {
               doc: {
                  ingredientName: data.ingredientName,
                  normalizedName: data.normalizedName,
                  ingredientSlug: data.ingredientSlug,
                  ingredientDescription: data.ingredientDescription,
                  ingredientImageUrl: data.ingredientImageUrl,
                  categoryId: data.categoryId,
                  categoryName: data.categoryName,
                  defaultUnit: data.defaultUnit,
                  ingredientStatus: data.ingredientStatus,
                  supplierCount: data.supplierCount,
                  minPrice: data.minPrice,
                  maxPrice: data.maxPrice,
                  currency: data.currency,
                  updatedAt: data.updatedAt ? new Date(data.updatedAt) : new Date(),
               },
            },
         });
         if (context) {
            this.rmqService.ack(context);
         }
      } catch (error) {
         this.logger.error(
            `Error queuing ${COMMERCE_EVENTS.INGREDIENT_UPDATED}`,
            error instanceof Error ? error.stack : undefined,
         );
         await this.rmqService.handleError(error, context, { queue: QUEUES.SEARCH });
      }
   }

   @EventPattern(COMMERCE_EVENTS.INGREDIENT_DELETED)
   async handleIngredientDeleted(
      @Payload() data: IngredientDeletedPayload,
      @Ctx() context?: RmqContext,
   ): Promise<void> {
      try {
         this.logger.log(`Received ${COMMERCE_EVENTS.INGREDIENT_DELETED} event for ${data.ingredientId}`);
         await this.bulkQueue.addOperation({
            operation: BULK_OPERATIONS.DELETE,
            index: SEARCH_INDICES.INGREDIENTS,
            documentId: data.ingredientId,
         });
         if (context) {
            this.rmqService.ack(context);
         }
      } catch (error) {
         this.logger.error(
            `Error queuing ${COMMERCE_EVENTS.INGREDIENT_DELETED}`,
            error instanceof Error ? error.stack : undefined,
         );
         await this.rmqService.handleError(error, context, { queue: QUEUES.SEARCH });
      }
   }

   @MessagePattern({ cmd: SEARCH_PATTERNS.SEARCH_INGREDIENTS })
   async searchIngredients(@Payload() data: SearchIngredientsParams, @Ctx() context?: RmqContext) {
      try {
         const result = await this.ingredientSearchService.searchIngredients(data);
         if (context) {
            this.rmqService.ack(context);
         }
         return result;
      } catch (error) {
         await this.rmqService.handleError(error, context, { queue: QUEUES.SEARCH });
         throw error;
      }
   }

   @EventPattern('product.event.registered')
   async handleProductRegistered(@Payload() data: Record<string, unknown>, @Ctx() context?: RmqContext): Promise<void> {
      try {
         const productId = data.productId as string;
         this.logger.log(`Received product.event.registered event for ${productId}`);
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
               images: data.images,
               status: data.status,
               moderationStatus: data.moderationStatus,
               variants: data.variants,
               createdAt: data.createdAt ? new Date(data.createdAt as string) : new Date(),
               updatedAt: new Date(),
            },
         });
         if (context) {
            this.rmqService.ack(context);
         }
      } catch (error) {
         this.logger.error('Error queuing product.event.registered', error instanceof Error ? error.stack : undefined);
         await this.rmqService.handleError(error, context, { queue: QUEUES.SEARCH });
      }
   }

   @EventPattern('product.event.approved')
   async handleProductApproved(@Payload() data: Record<string, unknown>, @Ctx() context?: RmqContext): Promise<void> {
      try {
         const productId = data.productId as string;
         this.logger.log(`Received product.event.approved event for ${productId}`);
         await this.bulkQueue.addOperation({
            operation: BULK_OPERATIONS.UPDATE,
            index: SEARCH_INDICES.PRODUCTS,
            documentId: productId,
            data: {
               doc: {
                  moderationStatus: data.moderationStatus,
                  status: 'ACTIVE',
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
         this.logger.error('Error queuing product.event.approved', error instanceof Error ? error.stack : undefined);
         await this.rmqService.handleError(error, context, { queue: QUEUES.SEARCH });
      }
   }
}
