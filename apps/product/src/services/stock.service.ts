import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
   PRODUCT_ERROR_CODES,
   type AdjustStockDto,
   type CheckAndReserveStockDto,
   type CheckAndReserveStockResponseDto,
   type ReleaseStockDto,
} from '@contracts/product';
import { PRODUCT_EVENT_PUBLISHER, type IProductEventPublisher } from '@product/publishers';
import { PRODUCT_UNIT_OF_WORK, type IProductUnitOfWork } from '@product/unit-of-work';
import { OutboxService } from '@product/outbox';
import { ProductMetricsService } from './product-metrics.service';

@Injectable()
export class StockService {
   constructor(
      @Inject(PRODUCT_UNIT_OF_WORK)
      private readonly uow: IProductUnitOfWork,
      @Inject(PRODUCT_EVENT_PUBLISHER)
      private readonly publisher: IProductEventPublisher,
      private readonly outboxService: OutboxService,
      private readonly metricsService: ProductMetricsService,
   ) {}

   async adjustStock(variantId: string, dto: AdjustStockDto): Promise<{ variantId: string; newStockQuantity: number }> {
      try {
         const result = await this.uow.runInTransaction(async (repos) => {
            const variant = await repos.productVariantRepository.findById(variantId);
            if (!variant) {
               throw new NotFoundException({
                  code: PRODUCT_ERROR_CODES.VARIANT_NOT_FOUND,
                  message: `Product variant ${variantId} not found`,
               });
            }

            if (variant.stockQuantity + dto.quantityDelta < 0) {
               throw new BadRequestException({
                  code: PRODUCT_ERROR_CODES.STOCK_INSUFFICIENT,
                  message: `Insufficient stock for variant ${variantId}. Current: ${variant.stockQuantity}, Delta: ${dto.quantityDelta}`,
               });
            }

            const updated = await repos.productVariantRepository.adjustStock(variantId, dto.quantityDelta);

            await repos.stockMovementRepository.create({
               variantId,
               movementType: dto.movementType,
               quantity: dto.quantityDelta,
               balanceAfter: updated.stockQuantity,
               reason: dto.reason,
            });

            await this.outboxService.emitEvent({
               aggregateId: variantId,
               aggregateType: 'PRODUCT_VARIANT',
               eventType: 'STOCK_ADJUSTED',
               payload: {
                  variantId,
                  sku: updated.sku,
                  productId: updated.productId,
                  delta: dto.quantityDelta,
                  newStock: updated.stockQuantity,
                  movementType: dto.movementType,
                  timestamp: new Date().toISOString(),
               },
            });

            await this.publisher.publishStockAdjusted({
               variantId,
               sku: updated.sku,
               productId: updated.productId,
               delta: dto.quantityDelta,
               newStock: updated.stockQuantity,
               movementType: dto.movementType,
               timestamp: new Date().toISOString(),
            });

            return {
               variantId: updated.variantId,
               newStockQuantity: updated.stockQuantity,
            };
         });

         this.metricsService.recordStockAdjustment('success');
         return result;
      } catch (error) {
         this.metricsService.recordStockAdjustment('failed');
         throw error;
      }
   }

   async checkAndReserveStock(dto: CheckAndReserveStockDto): Promise<CheckAndReserveStockResponseDto> {
      try {
         const result = await this.uow.runInTransaction(async (repos) => {
            const results: CheckAndReserveStockResponseDto['results'] = [];
            let allReserved = true;

            for (const item of dto.items) {
               const variant = await repos.productVariantRepository.findById(item.variantId);
               if (!variant) {
                  results.push({
                     variantId: item.variantId,
                     sku: '',
                     success: false,
                     availableStock: 0,
                     message: `Variant ${item.variantId} not found`,
                  });
                  allReserved = false;
                  break;
               }

               if (variant.stockQuantity < item.quantity) {
                  results.push({
                     variantId: item.variantId,
                     sku: variant.sku,
                     success: false,
                     availableStock: variant.stockQuantity,
                     message: `Insufficient stock for ${variant.sku}. Required: ${item.quantity}, Available: ${variant.stockQuantity}`,
                  });
                  allReserved = false;
                  break;
               }
            }

            if (!allReserved) {
               return { allReserved: false, results };
            }

            // If all available, reserve each
            for (const item of dto.items) {
               const updated = await repos.productVariantRepository.reserveStock(item.variantId, item.quantity);

               if (updated) {
                  await repos.stockMovementRepository.create({
                     variantId: item.variantId,
                     movementType: 'RESERVATION',
                     quantity: -item.quantity,
                     balanceAfter: updated.stockQuantity,
                     referenceType: 'ORDER',
                     referenceId: dto.orderId,
                     reason: `Reserved for order ${dto.orderId}`,
                  });

                  results.push({
                     variantId: item.variantId,
                     sku: updated.sku,
                     success: true,
                     availableStock: updated.stockQuantity,
                     message: 'Stock reserved successfully',
                  });
               }
            }

            return { allReserved: true, results };
         });

         this.metricsService.recordStockReservation('reserve', result.allReserved ? 'success' : 'failed');
         return result;
      } catch (error) {
         this.metricsService.recordStockReservation('reserve', 'failed');
         throw error;
      }
   }

   async releaseStock(dto: ReleaseStockDto): Promise<{ success: boolean; orderId: string }> {
      try {
         await this.uow.runInTransaction(async (repos) => {
            for (const item of dto.items) {
               const updated = await repos.productVariantRepository.releaseStock(item.variantId, item.quantity);

               await repos.stockMovementRepository.create({
                  variantId: item.variantId,
                  movementType: 'RELEASE',
                  quantity: item.quantity,
                  balanceAfter: updated.stockQuantity,
                  referenceType: 'ORDER',
                  referenceId: dto.orderId,
                  reason: `Released from order ${dto.orderId}`,
               });
            }
         });

         this.metricsService.recordStockReservation('release', 'success');
         return { success: true, orderId: dto.orderId };
      } catch (error) {
         this.metricsService.recordStockReservation('release', 'failed');
         throw error;
      }
   }
}
