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
   };

   const mockGrpcClient = {
      getService: jest.fn().mockReturnValue(mockGrpcService),
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
      service = new ProductsService(mockGrpcClient as never, mockCacheService as never);
      service.onModuleInit();
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
});
