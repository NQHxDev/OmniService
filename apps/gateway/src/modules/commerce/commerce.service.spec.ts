import { Test, TestingModule } from '@nestjs/testing';
import { of, throwError } from 'rxjs';
import { CommerceService } from '@/modules/commerce/commerce.service';
import { COMMERCE_V1_GRPC_CLIENT, CurrencyEnum } from '@contracts/commerce';
import { SEARCH_V1_GRPC_CLIENT } from '@contracts/search';
import { BulkheadRegistry, CircuitBreakerRegistry, GrpcStatus } from '@common';

describe('CommerceService Resiliency & Fallback Strategy', () => {
   let service: CommerceService;

   const mockCommerceGrpcService = {
      listCategories: jest.fn(),
      getSuppliersByIngredient: jest.fn(),
      createIngredient: jest.fn(),
   };

   const mockSearchGrpcService = {
      searchIngredients: jest.fn(),
   };

   const mockCommerceClient = {
      getService: jest.fn().mockReturnValue(mockCommerceGrpcService),
   };

   const mockSearchClient = {
      getService: jest.fn().mockReturnValue(mockSearchGrpcService),
   };

   beforeEach(async () => {
      CircuitBreakerRegistry.clear();
      BulkheadRegistry.clear();
      jest.clearAllMocks();

      const module: TestingModule = await Test.createTestingModule({
         providers: [
            CommerceService,
            { provide: COMMERCE_V1_GRPC_CLIENT, useValue: mockCommerceClient },
            { provide: SEARCH_V1_GRPC_CLIENT, useValue: mockSearchClient },
         ],
      }).compile();

      service = module.get<CommerceService>(CommerceService);
      service.onModuleInit();
   });

   describe('searchIngredients Fallback', () => {
      it('should return search results on downstream success', async () => {
         mockSearchGrpcService.searchIngredients.mockReturnValue(
            of({
               items: [
                  {
                     ingredientId: 'ing-1',
                     ingredientName: 'Tomato',
                     normalizedName: 'tomato',
                     ingredientSlug: 'tomato',
                     currency: CurrencyEnum.VND,
                  },
               ],
               total: 1,
               limit: 20,
               offset: 0,
            }),
         );

         const result = await service.searchIngredients({ query: 'Tomato' });

         expect(result.items).toHaveLength(1);
         expect(result.items[0].ingredientName).toBe('Tomato');
         expect(result.total).toBe(1);
      });

      it('should gracefully degrade to empty results when Search microservice is unavailable', async () => {
         mockSearchGrpcService.searchIngredients.mockReturnValue(
            throwError(() => ({
               code: GrpcStatus.UNAVAILABLE,
               message: '14 UNAVAILABLE: Search service down',
            })),
         );

         const result = await service.searchIngredients({ query: 'Tomato', limit: 15, offset: 0 });

         expect(result).toEqual({
            items: [],
            total: 0,
            limit: 15,
            offset: 0,
         });
      });
   });

   describe('listCategories Fallback', () => {
      it('should return categories on downstream success', async () => {
         mockCommerceGrpcService.listCategories.mockReturnValue(
            of({
               categories: [
                  {
                     categoryId: 'cat-1',
                     categoryName: 'Spices',
                     categorySlug: 'spices',
                  },
               ],
            }),
         );

         const result = await service.listCategories();

         expect(result).toHaveLength(1);
         expect(result[0].categoryName).toBe('Spices');
      });

      it('should return empty list fallback when Commerce microservice fails', async () => {
         mockCommerceGrpcService.listCategories.mockReturnValue(
            throwError(() => ({
               code: GrpcStatus.UNAVAILABLE,
               message: 'Commerce service partition',
            })),
         );

         const result = await service.listCategories();

         expect(result).toEqual([]);
      });
   });

   describe('getSuppliersByIngredient Fallback', () => {
      it('should return graceful empty offers structure when service fails', async () => {
         mockCommerceGrpcService.getSuppliersByIngredient.mockReturnValue(
            throwError(() => ({
               code: GrpcStatus.UNAVAILABLE,
               message: 'Service unavailable',
            })),
         );

         const result = await service.getSuppliersByIngredient('ing-123');

         expect(result).toEqual({
            ingredientId: 'ing-123',
            ingredientName: '',
            offers: [],
            totalOffers: 0,
         });
      });
   });
});
