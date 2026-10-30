import { CacheNamespace } from '@common';
import { ProductService } from '@product/services/product.service';
import { PRODUCT_CACHE_KEYS, PRODUCT_CACHE_TTL, WHO_FOOD_GROUPS } from '@contracts/product';

describe('ProductService', () => {
   let service: ProductService;

   const mockCategories = WHO_FOOD_GROUPS.map((g) => ({
      code: g.code,
      name: g.name,
      description: g.description,
      examples: g.examples,
      order: g.order,
      createdAt: new Date(),
      updatedAt: new Date(),
   }));

   const mockWhoCategoryRepo = {
      findAll: jest.fn(),
      findByCode: jest.fn(),
   };

   const mockUow = {
      runInTransaction: jest.fn().mockImplementation((cb) => {
         return cb({
            whoCategoryRepository: mockWhoCategoryRepo,
         });
      }),
   };

   const mockPublisher = {
      publish: jest.fn(),
   };

   const mockOutboxService = {
      createEvent: jest.fn(),
   };

   const mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
   };

   beforeEach(() => {
      jest.clearAllMocks();
      service = new ProductService(
         mockUow as never,
         mockPublisher as never,
         mockOutboxService as never,
         mockCacheService as never,
      );
   });

   describe('listWhoCategories with 12h cache', () => {
      it('should return from cache when cache hit occurs and bypass DB transaction', async () => {
         mockCacheService.get.mockResolvedValue(mockCategories);

         const result = await service.listWhoCategories();

         expect(mockCacheService.get).toHaveBeenCalledWith(
            CacheNamespace.PRODUCT,
            PRODUCT_CACHE_KEYS.WHO_CATEGORIES_ALL,
         );
         expect(mockUow.runInTransaction).not.toHaveBeenCalled();
         expect(mockWhoCategoryRepo.findAll).not.toHaveBeenCalled();
         expect(result).toEqual(mockCategories);
      });

      it('should query DB on cache miss, cache result for 12 hours (43200s), and return data', async () => {
         mockCacheService.get.mockResolvedValue(null);
         mockWhoCategoryRepo.findAll.mockResolvedValue(mockCategories);

         const result = await service.listWhoCategories();

         expect(mockCacheService.get).toHaveBeenCalledWith(
            CacheNamespace.PRODUCT,
            PRODUCT_CACHE_KEYS.WHO_CATEGORIES_ALL,
         );
         expect(mockUow.runInTransaction).toHaveBeenCalled();
         expect(mockWhoCategoryRepo.findAll).toHaveBeenCalled();
         expect(mockCacheService.set).toHaveBeenCalledWith(
            CacheNamespace.PRODUCT,
            PRODUCT_CACHE_KEYS.WHO_CATEGORIES_ALL,
            mockCategories,
            PRODUCT_CACHE_TTL.WHO_CATEGORIES_SECONDS,
         );
         expect(PRODUCT_CACHE_TTL.WHO_CATEGORIES_SECONDS).toBe(43200);
         expect(result).toHaveLength(8);
      });

      it('should degrade gracefully and query DB if cache service errors', async () => {
         mockCacheService.get.mockRejectedValue(new Error('Redis timeout'));
         mockWhoCategoryRepo.findAll.mockResolvedValue(mockCategories);

         const result = await service.listWhoCategories();

         expect(mockUow.runInTransaction).toHaveBeenCalled();
         expect(result).toHaveLength(8);
      });
   });
});
