import { Test, TestingModule } from '@nestjs/testing';
import { RmqContext } from '@nestjs/microservices';
import { AppLogger, RmqService } from '@common';
import { BULK_OPERATIONS, SEARCH_INDICES } from '@contracts/search';
import { MODERATION_STATUS, PRODUCT_STATUS } from '@contracts/product';
import { BulkIndexQueue } from '@search/core/queue';
import { ProductSearchController } from '@search/domains/product-search/product-search.controller';
import { ProductSearchService } from '@search/domains/product-search/product-search.service';

describe('ProductSearchController', () => {
   let controller: ProductSearchController;
   let bulkQueue: { addOperation: jest.Mock };
   let rmqService: { ack: jest.Mock; handleError: jest.Mock };
   let mockContext: RmqContext;

   const mockLogger = {
      setContext: jest.fn(),
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
   };

   const mockProductSearchService = {
      searchProducts: jest.fn(),
      suggestProducts: jest.fn(),
   };

   beforeEach(async () => {
      bulkQueue = {
         addOperation: jest.fn().mockResolvedValue(undefined),
      };
      rmqService = {
         ack: jest.fn(),
         handleError: jest.fn(),
      };
      mockContext = {} as RmqContext;

      const module: TestingModule = await Test.createTestingModule({
         controllers: [ProductSearchController],
         providers: [
            {
               provide: ProductSearchService,
               useValue: mockProductSearchService,
            },
            {
               provide: BulkIndexQueue,
               useValue: bulkQueue,
            },
            {
               provide: RmqService,
               useValue: rmqService,
            },
            {
               provide: AppLogger,
               useValue: mockLogger,
            },
         ],
      }).compile();

      controller = module.get<ProductSearchController>(ProductSearchController);
   });

   describe('handleProductRegistered', () => {
      it('should NOT queue ES indexing when product is registered, and should ack message', async () => {
         const data = {
            productId: 'p-1',
            productName: 'Draft Product',
            status: PRODUCT_STATUS.DRAFT,
            moderationStatus: MODERATION_STATUS.PENDING_APPROVAL,
         };

         await controller.handleProductRegistered(data, mockContext);

         expect(bulkQueue.addOperation).not.toHaveBeenCalled();
         expect(rmqService.ack).toHaveBeenCalledWith(mockContext);
      });
   });

   describe('handleProductApproved', () => {
      it('should queue BULK_OPERATIONS.INDEX with full product details when approved by admin', async () => {
         const data = {
            productId: 'p-100',
            supplierId: 's-1',
            whoCategoryCode: 'STAPLES',
            productName: 'ST25 Rice',
            productSlug: 'st25-rice',
            description: 'Delicious rice',
            origin: 'Vietnam',
            storageCondition: 'Dry',
            shelfLifeDays: 365,
            images: ['https://example.com/st25.png'],
            status: PRODUCT_STATUS.ACTIVE,
            moderationStatus: MODERATION_STATUS.APPROVED,
            variants: [
               {
                  variantId: 'v-1',
                  sku: 'ST25-5KG',
                  price: 180000,
                  currency: 'VND',
               },
            ],
            minPrice: 180000,
            maxPrice: 180000,
            createdAt: '2026-01-01T00:00:00.000Z',
         };

         await controller.handleProductApproved(data, mockContext);

         expect(bulkQueue.addOperation).toHaveBeenCalledWith({
            operation: BULK_OPERATIONS.INDEX,
            index: SEARCH_INDICES.PRODUCTS,
            documentId: 'p-100',
            data: expect.objectContaining({
               productId: 'p-100',
               productName: 'ST25 Rice',
               status: PRODUCT_STATUS.ACTIVE,
               moderationStatus: MODERATION_STATUS.APPROVED,
               whoCategoryCode: 'STAPLES',
               minPrice: 180000,
               maxPrice: 180000,
            }),
         });
         expect(rmqService.ack).toHaveBeenCalledWith(mockContext);
      });

      it('should fallback to BULK_OPERATIONS.UPDATE if payload lacks product details', async () => {
         const data = {
            productId: 'p-100',
            moderationStatus: MODERATION_STATUS.APPROVED,
            moderatedBy: 'admin-1',
            moderatedAt: '2026-01-01T00:00:00.000Z',
         };

         await controller.handleProductApproved(data, mockContext);

         expect(bulkQueue.addOperation).toHaveBeenCalledWith({
            operation: BULK_OPERATIONS.UPDATE,
            index: SEARCH_INDICES.PRODUCTS,
            documentId: 'p-100',
            data: {
               doc: expect.objectContaining({
                  moderationStatus: MODERATION_STATUS.APPROVED,
                  status: PRODUCT_STATUS.ACTIVE,
                  moderatedBy: 'admin-1',
               }),
            },
         });
         expect(rmqService.ack).toHaveBeenCalledWith(mockContext);
      });
   });

   describe('handleProductSuspended', () => {
      it('should queue BULK_OPERATIONS.UPDATE with INACTIVE and SUSPENDED status', async () => {
         const data = {
            productId: 'p-100',
            moderationStatus: MODERATION_STATUS.SUSPENDED,
            moderatedBy: 'admin-1',
         };

         await controller.handleProductSuspended(data, mockContext);

         expect(bulkQueue.addOperation).toHaveBeenCalledWith({
            operation: BULK_OPERATIONS.UPDATE,
            index: SEARCH_INDICES.PRODUCTS,
            documentId: 'p-100',
            data: {
               doc: expect.objectContaining({
                  moderationStatus: MODERATION_STATUS.SUSPENDED,
                  status: PRODUCT_STATUS.INACTIVE,
               }),
            },
         });
         expect(rmqService.ack).toHaveBeenCalledWith(mockContext);
      });
   });
});
