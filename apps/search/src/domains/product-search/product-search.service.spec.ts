import { Test, TestingModule } from '@nestjs/testing';
import { AppLogger } from '@common';
import { ElasticsearchService } from '@search/core/elasticsearch';
import { ProductSearchService, type ProductDocument } from '@search/domains/product-search/product-search.service';

describe('ProductSearchService', () => {
   let service: ProductSearchService;

   const mockClient = {
      indices: {
         exists: jest.fn().mockResolvedValue(true),
         create: jest.fn().mockResolvedValue({}),
      },
      index: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
      search: jest.fn(),
   };

   const mockElasticsearchService = {
      getClient: jest.fn().mockReturnValue(mockClient),
   };

   const mockLogger = {
      setContext: jest.fn(),
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
   };

   const sampleProductDoc: ProductDocument = {
      productId: 'p-1',
      supplierId: 's-1',
      whoCategoryCode: 'STAPLES',
      productName: 'ST25 Rice',
      productSlug: 'st25-rice',
      description: 'Delicious rice',
      origin: 'Soc Trang',
      images: ['https://example.com/st25.png'],
      status: 'ACTIVE',
      moderationStatus: 'APPROVED',
      variants: [
         {
            variantId: 'v-1',
            sku: 'ST25-5KG',
            variantName: '5kg Bag',
            unit: 'kg',
            price: 180000,
            currency: 'VND',
            stockQuantity: 10,
            isDefault: true,
            status: 'ACTIVE',
         },
      ],
      minPrice: 180000,
      maxPrice: 180000,
      currency: 'VND',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
   };

   beforeEach(async () => {
      jest.clearAllMocks();

      const module: TestingModule = await Test.createTestingModule({
         providers: [
            ProductSearchService,
            {
               provide: ElasticsearchService,
               useValue: mockElasticsearchService,
            },
            {
               provide: AppLogger,
               useValue: mockLogger,
            },
         ],
      }).compile();

      service = module.get<ProductSearchService>(ProductSearchService);
   });

   describe('searchProducts', () => {
      it('should search products with query and return paginated result', async () => {
         mockClient.search.mockResolvedValue({
            hits: {
               total: { value: 1 },
               hits: [
                  {
                     _source: sampleProductDoc,
                  },
               ],
            },
         });

         const result = await service.searchProducts({ query: 'rice', limit: 20, offset: 0 });

         expect(mockClient.search).toHaveBeenCalledWith(
            expect.objectContaining({
               index: 'products',
               from: 0,
               size: 20,
            }),
         );
         expect(result.items).toHaveLength(1);
         expect(result.items[0].productId).toBe('p-1');
         expect(result.total).toBe(1);
      });

      it('should apply category and supplier filter clauses', async () => {
         mockClient.search.mockResolvedValue({
            hits: {
               total: { value: 0 },
               hits: [],
            },
         });

         await service.searchProducts({
            query: 'rice',
            whoCategoryCode: 'STAPLES',
            supplierId: 's-1',
            status: 'ACTIVE',
         });

         expect(mockClient.search).toHaveBeenCalledWith(
            expect.objectContaining({
               body: expect.objectContaining({
                  query: expect.objectContaining({
                     bool: expect.objectContaining({
                        filter: expect.arrayContaining([
                           { term: { whoCategoryCode: 'STAPLES' } },
                           { term: { supplierId: 's-1' } },
                           { term: { status: 'ACTIVE' } },
                        ]),
                     }),
                  }),
               }),
            }),
         );
      });
   });

   describe('suggestProducts', () => {
      it('should return empty list when query is empty', async () => {
         const result = await service.suggestProducts({ query: '' });
         expect(result.items).toEqual([]);
         expect(mockClient.search).not.toHaveBeenCalled();
      });

      it('should query suggestions and map items with default variant info', async () => {
         mockClient.search.mockResolvedValue({
            hits: {
               hits: [
                  {
                     _source: sampleProductDoc,
                  },
               ],
            },
         });

         const result = await service.suggestProducts({ query: 'st2', limit: 5 });

         expect(mockClient.search).toHaveBeenCalledWith(
            expect.objectContaining({
               index: 'products',
               size: 5,
            }),
         );
         expect(result.items).toHaveLength(1);
         expect(result.items[0].productId).toBe('p-1');
         expect(result.items[0].productName).toBe('ST25 Rice');
         expect(result.items[0].defaultUnit).toBe('kg');
         expect(result.items[0].minPrice).toBe(180000);
      });
   });

   describe('indexProduct and updateProduct and deleteProduct', () => {
      it('should index product document into products index', async () => {
         await service.indexProduct(sampleProductDoc);
         expect(mockClient.index).toHaveBeenCalledWith({
            index: 'products',
            id: 'p-1',
            document: expect.objectContaining({ productId: 'p-1' }),
         });
      });

      it('should update product document in products index', async () => {
         await service.updateProduct('p-1', { productName: 'Updated ST25' });
         expect(mockClient.update).toHaveBeenCalledWith({
            index: 'products',
            id: 'p-1',
            doc: expect.objectContaining({ productName: 'Updated ST25' }),
         });
      });

      it('should delete product document from products index', async () => {
         await service.deleteProduct('p-1');
         expect(mockClient.delete).toHaveBeenCalledWith({
            index: 'products',
            id: 'p-1',
         });
      });
   });
});
