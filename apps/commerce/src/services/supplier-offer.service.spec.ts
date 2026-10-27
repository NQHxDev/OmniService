import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { INGREDIENT_REPOSITORY, SUPPLIER_PRODUCT_REPOSITORY } from '@commerce/repositories';
import { SUPPLIER_ADAPTER } from '@commerce/adapters/supplier';
import { ForbiddenException } from '@common';
import { COMMERCE_EVENTS, CurrencyEnum, INGREDIENT_STATUS, OFFER_STATUS, SUPPLIER_STATUS } from '@contracts/commerce';
import { SupplierOfferService } from '@commerce/services/supplier-offer.service';

describe('SupplierOfferService', () => {
   let service: SupplierOfferService;

   const mockSupplierAdapter = {
      getSupplierById: jest.fn(),
      getSuppliersByIds: jest.fn(),
   };

   const mockIngredientRepo = {
      findById: jest.fn(),
   };

   const mockSupplierProductRepo = {
      findByIngredientId: jest.fn(),
      findBySupplierAndSku: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      updateStock: jest.fn(),
   };

   const mockEventEmitter = {
      emit: jest.fn(),
   };

   beforeEach(async () => {
      jest.clearAllMocks();

      const module: TestingModule = await Test.createTestingModule({
         providers: [
            SupplierOfferService,
            { provide: SUPPLIER_ADAPTER, useValue: mockSupplierAdapter },
            { provide: INGREDIENT_REPOSITORY, useValue: mockIngredientRepo },
            { provide: SUPPLIER_PRODUCT_REPOSITORY, useValue: mockSupplierProductRepo },
            { provide: EventEmitter2, useValue: mockEventEmitter },
         ],
      }).compile();

      service = module.get<SupplierOfferService>(SupplierOfferService);
   });

   it('should create product offer successfully', async () => {
      mockSupplierAdapter.getSupplierById.mockResolvedValue({
         supplierId: 'supp-1',
         supplierStatus: SUPPLIER_STATUS.ACTIVE,
         isVerified: true,
      });
      mockIngredientRepo.findById.mockResolvedValue({
         ingredientId: 'ing-1',
         ingredientStatus: INGREDIENT_STATUS.ACTIVE,
      });
      mockSupplierProductRepo.findBySupplierAndSku.mockResolvedValue(null);
      mockSupplierProductRepo.create.mockResolvedValue({
         productId: 'prod-1',
         supplierId: 'supp-1',
         ingredientId: 'ing-1',
         productSku: 'SKU-MM-TOMATO',
         price: 25000,
         currency: CurrencyEnum.VND,
         stockQuantity: 100,
         offerStatus: OFFER_STATUS.AVAILABLE,
         version: 1,
         deletedAt: null,
         createdAt: new Date(),
         updatedAt: new Date(),
      });

      const result = await service.createProductOffer({
         supplierId: 'supp-1',
         ingredientId: 'ing-1',
         productSku: 'SKU-MM-TOMATO',
         productTitle: 'Cà chua Đà Lạt',
         price: 25000,
         currency: CurrencyEnum.VND,
      });

      expect(result.productId).toBe('prod-1');
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(COMMERCE_EVENTS.PRODUCT_OFFER_CREATED, expect.anything());
   });

   it('should throw ForbiddenException if supplier is not verified', async () => {
      mockSupplierAdapter.getSupplierById.mockResolvedValue({
         supplierId: 'supp-1',
         supplierStatus: SUPPLIER_STATUS.PENDING,
         isVerified: false,
      });

      await expect(
         service.createProductOffer({
            supplierId: 'supp-1',
            ingredientId: 'ing-1',
            productSku: 'SKU-MM-TOMATO',
            productTitle: 'Cà chua Đà Lạt',
            price: 25000,
            currency: CurrencyEnum.VND,
         }),
      ).rejects.toThrow(ForbiddenException);
   });
});
