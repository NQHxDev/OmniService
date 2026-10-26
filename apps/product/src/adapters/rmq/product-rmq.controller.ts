import { Controller, Logger } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import { QUEUES, RmqService } from '@common';
import { PRODUCT_EVENTS, type ProductStockAdjustedEventPayload } from '@contracts/product';

@Controller()
export class ProductRmqController {
   private readonly logger = new Logger(ProductRmqController.name);

   constructor(private readonly rmqService: RmqService) {}

   @EventPattern(PRODUCT_EVENTS.STOCK_ADJUSTED)
   async handleStockAdjusted(@Payload() data: ProductStockAdjustedEventPayload, @Ctx() context?: RmqContext) {
      try {
         this.logger.log(`Received STOCK_ADJUSTED for variant ${data?.variantId}, delta: ${data?.delta}`);
         if (context) {
            this.rmqService.ack(context);
         }
      } catch (error) {
         this.logger.error(`Error handling STOCK_ADJUSTED event: ${error}`);
         if (context) {
            await this.rmqService.handleError(error, context, { queue: QUEUES.PRODUCT });
         }
         throw error;
      }
   }
}
