import { of } from 'rxjs';
import { CacheNamespace } from '@common';
import {
   PRODUCT_CACHE_KEYS,
   PRODUCT_CACHE_TTL,
   WHO_FOOD_GROUPS,
   type IProductV1GrpcService,
   type WhoCategoryDto,
} from '@contracts/product';
import { ProductsService } from '@gateway/modules/products/products.service';

describe('ProductsService', () => {
   let service: ProductsService;

   const mockGrpcService: Partial<IProductV1GrpcService> = {
      listWhoCategories: jest.fn(),
      getProductById: jest.fn(),
   };

   const mockOrdersService = {
      getProductOrderStats: jest.fn(),
   };

   const mockSuppliersService = {
      getSupplierById: jest.fn(),
   };

   const mockSearchGrpcService = {
      searchProducts: jest.fn(),
      suggestProducts: jest.fn(),
   };

   const mockGrpcClient = {
      getService: jest.fn().mockReturnValue(mockGrpcService),
   };

   const mockSearchGrpcClient = {
      getService: jest.fn().mockReturnValue(mockSearchGrpcService),
   };

   const mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
   };

   const sampleCategories: WhoCategoryDto[] = WHO_FOOD_GROUPS.map((g) => ({
      code: g.code,
      name: g.name,
      description: g.description,
      examples: g.examples,
      order: g.order,
   }));

   beforeEach(() => {
      jest.clearAllMocks();
      service = new ProductsService(
         mockGrpcClient as never,
         mockSearchGrpcClient as never,
         mockOrdersService as never,
         mockSuppliersService as never,
         mockCacheService as never,
      );
      service.onModuleInit();
   });

   describe('getProductById enrichment', () => {
      const protoProduct = {
         productId: 'p-1',
         supplierId: 's-1',
         whoCategoryCode: 'STAPLES',
         productName: 'Gạo ST25',
         productSlug: 'gao-st25',
         description: 'desc',
         images: [],
         status: 'ACTIVE',
         moderationStatus: 'APPROVED',
         variants: [],
         version: 1,
         createdAt: '2026-10-26T08:00:00.000Z',
         updatedAt: '2026-10-26T08:00:00.000Z',
      };

      beforeEach(() => {
         (mockGrpcService.getProductById as jest.Mock).mockReturnValue(of({ product: protoProduct }));
      });

      it('should attach store summary and order statistics', async () => {
         mockSuppliersService.getSupplierById.mockResolvedValue({
            supplierId: 's-1',
            supplierName: 'Mega Market',
            supplierSlug: 'mega-market',
            supplierLogoUrl: 'logo.png',
            city: 'HCM',
            rating: 4.8,
            isVerified: true,
            bankAccountNumber: 'SECRET',
         });
         mockOrdersService.getProductOrderStats.mockResolvedValue([{ productId: 'p-1', orderCount: 3, soldCount: 12 }]);

         const result = await service.getProductById('p-1');

         expect(result.orderCount).toBe(3);
         expect(result.soldCount).toBe(12);
         expect(result.supplier?.supplierName).toBe('Mega Market');
         expect(result.supplier).not.toHaveProperty('bankAccountNumber');
      });

      it('should degrade gracefully when downstream services fail', async () => {
         mockSuppliersService.getSupplierById.mockRejectedValue(new Error('down'));
         mockOrdersService.getProductOrderStats.mockRejectedValue(new Error('down'));

         const result = await service.getProductById('p-1');

         expect(result.supplier).toBeUndefined();
         expect(result.orderCount).toBe(0);
         expect(result.soldCount).toBe(0);
      });
   });

   describe('listWhoCategories with 12h caching', () => {
      it('should return categories from Redis cache when cache hit occurs', async () => {
         mockCacheService.get.mockResolvedValue(sampleCategories);

         const result = await service.listWhoCategories();

         expect(mockCacheService.get).toHaveBeenCalledWith(
            CacheNamespace.GATEWAY,
            PRODUCT_CACHE_KEYS.WHO_CATEGORIES_ALL,
         );
         expect(mockGrpcService.listWhoCategories).not.toHaveBeenCalled();
         expect(result).toEqual(sampleCategories);
      });

      it('should fetch from gRPC service on cache miss and save to Redis with 12h TTL', async () => {
         mockCacheService.get.mockResolvedValue(null);
         (mockGrpcService.listWhoCategories as jest.Mock).mockReturnValue(
            of({
               categories: sampleCategories,
            }),
         );

         const result = await service.listWhoCategories();

         expect(mockCacheService.get).toHaveBeenCalledWith(
            CacheNamespace.GATEWAY,
            PRODUCT_CACHE_KEYS.WHO_CATEGORIES_ALL,
         );
         expect(mockGrpcService.listWhoCategories).toHaveBeenCalled();
         expect(mockCacheService.set).toHaveBeenCalledWith(
            CacheNamespace.GATEWAY,
            PRODUCT_CACHE_KEYS.WHO_CATEGORIES_ALL,
            sampleCategories,
            PRODUCT_CACHE_TTL.WHO_CATEGORIES_SECONDS,
         );
         expect(PRODUCT_CACHE_TTL.WHO_CATEGORIES_SECONDS).toBe(43200);
         expect(result).toHaveLength(8);
      });

      it('should gracefully degrade and fetch via gRPC if cache service throws an error', async () => {
         mockCacheService.get.mockRejectedValue(new Error('Redis connection down'));
         (mockGrpcService.listWhoCategories as jest.Mock).mockReturnValue(
            of({
               categories: sampleCategories,
            }),
         );

         const result = await service.listWhoCategories();

         expect(mockGrpcService.listWhoCategories).toHaveBeenCalled();
         expect(result).toHaveLength(8);
      });
   });

   describe('searchProducts', () => {
      it('should call searchGrpcService.searchProducts and map results', async () => {
         const mockHit = {
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
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-02T00:00:00.000Z',
         };

         mockSearchGrpcService.searchProducts.mockReturnValue(
            of({
               items: [mockHit],
               total: 1,
               limit: 20,
               offset: 0,
            }),
         );

         const result = await service.searchProducts({ query: 'rice' });

         expect(mockSearchGrpcService.searchProducts).toHaveBeenCalled();
         expect(result.items).toHaveLength(1);
         expect(result.items[0].productId).toBe('p-1');
         expect(result.items[0].productName).toBe('ST25 Rice');
         expect(result.items[0].variants).toHaveLength(1);
         expect(result.total).toBe(1);
      });
   });

   describe('suggestProducts', () => {
      it('should call searchGrpcService.suggestProducts and map suggestions', async () => {
         const mockSuggestion = {
            productId: 'p-1',
            productName: 'ST25 Rice',
            productSlug: 'st25-rice',
            whoCategoryCode: 'STAPLES',
            origin: 'Soc Trang',
            images: ['https://example.com/st25.png'],
            defaultUnit: 'kg',
            minPrice: 180000,
            maxPrice: 180000,
            currency: 'VND',
         };

         mockSearchGrpcService.suggestProducts.mockReturnValue(
            of({
               items: [mockSuggestion],
            }),
         );

         const result = await service.suggestProducts({ query: 'st2' });

         expect(mockSearchGrpcService.suggestProducts).toHaveBeenCalled();
         expect(result.items).toHaveLength(1);
         expect(result.items[0].productId).toBe('p-1');
         expect(result.items[0].productName).toBe('ST25 Rice');
      });
   });
});
