import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import { CORRELATION_ID_HEADER, type JwtPayload } from '@common';
import { WHO_FOOD_GROUPS, type WhoCategoryDto } from '@contracts/product';
import { ProductsController } from '@/modules/products/products.controller';
import { ProductsService } from '@/modules/products/products.service';

describe('ProductsController', () => {
   let controller: ProductsController;

   const mockProductsService = {
      listWhoCategories: jest.fn(),
      createProduct: jest.fn(),
      listProducts: jest.fn(),
      getProductById: jest.fn(),
      updateProduct: jest.fn(),
      moderateProduct: jest.fn(),
      updateProductStatus: jest.fn(),
      adjustStock: jest.fn(),
      checkAndReserveStock: jest.fn(),
      releaseStock: jest.fn(),
   };

   const sampleCategories: WhoCategoryDto[] = WHO_FOOD_GROUPS.map((g) => ({
      code: g.code,
      name: g.name,
      description: g.description,
      examples: g.examples,
      order: g.order,
   }));

   beforeEach(async () => {
      jest.clearAllMocks();

      const module: TestingModule = await Test.createTestingModule({
         controllers: [ProductsController],
         providers: [{ provide: ProductsService, useValue: mockProductsService }],
      }).compile();

      controller = module.get<ProductsController>(ProductsController);
   });

   describe('listCategories', () => {
      it('should return all 8 WHO nutrition categories', async () => {
         mockProductsService.listWhoCategories.mockResolvedValue(sampleCategories);

         const req = {
            headers: {
               [CORRELATION_ID_HEADER]: 'test-corr-id-123',
            },
         } as unknown as Request;

         const user: JwtPayload = {
            sub: 'user-uuid-1',
            email: 'chef@example.com',
            roles: ['USER'],
            permissions: [],
         };

         const result = await controller.listCategories(req, user);

         expect(mockProductsService.listWhoCategories).toHaveBeenCalledWith({
            correlationId: 'test-corr-id-123',
            accountId: 'user-uuid-1',
            roles: ['USER'],
            permissions: [],
            email: 'chef@example.com',
         });
         expect(result).toHaveLength(8);
         expect(result[0].code).toBe('STAPLES');
      });

      it('should handle anonymous requests without user', async () => {
         mockProductsService.listWhoCategories.mockResolvedValue(sampleCategories);

         const req = {
            headers: {},
         } as unknown as Request;

         const result = await controller.listCategories(req, undefined);

         expect(mockProductsService.listWhoCategories).toHaveBeenCalledWith({
            correlationId: undefined,
            accountId: undefined,
            roles: undefined,
            permissions: undefined,
            email: undefined,
         });
         expect(result).toEqual(sampleCategories);
      });
   });
});
