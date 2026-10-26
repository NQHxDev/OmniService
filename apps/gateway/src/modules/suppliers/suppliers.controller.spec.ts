import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import { CORRELATION_ID_HEADER, DEFAULT_ROLES } from '@common';
import { SUPPLIER_MEMBER_STATUS, SUPPLIER_ROLES, SUPPLIER_STATUS, type SupplierItemDto } from '@contracts/supplier';
import { SuppliersController } from '@/modules/suppliers/suppliers.controller';
import { SuppliersService } from '@/modules/suppliers/suppliers.service';

describe('SuppliersController', () => {
   let controller: SuppliersController;
   let mockSuppliersService: jest.Mocked<SuppliersService>;

   const mockSupplier: SupplierItemDto = {
      supplierId: '0192e21b-0003-7000-8000-000000000001',
      supplierName: 'Mega Market',
      supplierSlug: 'mega-market',
      supplierCode: 'SUPP-MM',
      contactEmail: 'contact@megamarket.vn',
      contactPhone: '0901234567',
      address: 'An Phu',
      city: 'Ho Chi Minh',
      rating: 5,
      isVerified: false,
      supplierStatus: SUPPLIER_STATUS.ACTIVE,
      supplierLogoUrl: 'https://example.com/logo.png',
   };

   beforeEach(async () => {
      mockSuppliersService = {
         registerSupplier: jest.fn(),
         getMySupplier: jest.fn(),
         listSuppliers: jest.fn(),
         getSupplierById: jest.fn(),
         updateSupplier: jest.fn(),
         updateSupplierStatus: jest.fn(),
         verifySupplier: jest.fn(),
      } as unknown as jest.Mocked<SuppliersService>;

      const module: TestingModule = await Test.createTestingModule({
         controllers: [SuppliersController],
         providers: [{ provide: SuppliersService, useValue: mockSuppliersService }],
      }).compile();

      controller = module.get<SuppliersController>(SuppliersController);
   });

   it('should extract user context and delegate registerSupplier to SuppliersService', async () => {
      mockSuppliersService.registerSupplier.mockResolvedValue(mockSupplier);

      const dto = {
         supplierName: 'Mega Market',
         supplierCode: 'SUPP-MM',
      };

      const mockRequest = {
         headers: {
            [CORRELATION_ID_HEADER]: 'corr-456',
         },
      } as unknown as Request;

      const mockUser = {
         sub: 'acc-123',
         email: 'test@example.com',
         roles: [SUPPLIER_ROLES.SUPPLIER_ADMIN],
      } as never;

      const result = await controller.registerSupplier(dto, mockRequest, mockUser);

      expect(mockSuppliersService.registerSupplier).toHaveBeenCalledWith(dto, {
         correlationId: 'corr-456',
         accountId: 'acc-123',
         roles: [SUPPLIER_ROLES.SUPPLIER_ADMIN],
         email: 'test@example.com',
      });
      expect(result).toEqual(mockSupplier);
   });

   it('should extract user context and delegate getMySupplier to SuppliersService', async () => {
      const mockMySupplier = {
         hasSupplier: true,
         supplier: mockSupplier,
         role: SUPPLIER_ROLES.SUPPLIER_ADMIN,
         memberStatus: SUPPLIER_MEMBER_STATUS.ACTIVE,
      };
      mockSuppliersService.getMySupplier.mockResolvedValue(mockMySupplier);

      const mockRequest = {
         headers: {
            [CORRELATION_ID_HEADER]: 'corr-456',
         },
      } as unknown as Request;

      const mockUser = {
         sub: 'acc-123',
         email: 'test@example.com',
         roles: [SUPPLIER_ROLES.SUPPLIER_ADMIN],
      } as never;

      const result = await controller.getMySupplier(mockRequest, mockUser);

      expect(mockSuppliersService.getMySupplier).toHaveBeenCalledWith({
         correlationId: 'corr-456',
         accountId: 'acc-123',
         roles: [SUPPLIER_ROLES.SUPPLIER_ADMIN],
         email: 'test@example.com',
      });
      expect(result).toEqual(mockMySupplier);
   });

   it('should delegate listSuppliers to SuppliersService with query parameters', async () => {
      const mockListResponse = {
         items: [mockSupplier],
         total: 1,
         limit: 10,
         offset: 0,
      };
      mockSuppliersService.listSuppliers.mockResolvedValue(mockListResponse);

      const mockRequest = {
         headers: {
            [CORRELATION_ID_HEADER]: 'corr-456',
         },
      } as unknown as Request;

      const result = await controller.listSuppliers({ limit: 10, offset: 0 }, mockRequest);

      expect(mockSuppliersService.listSuppliers).toHaveBeenCalledWith(
         { limit: 10, offset: 0 },
         expect.objectContaining({ correlationId: 'corr-456' }),
      );
      expect(result).toEqual(mockListResponse);
   });

   it('should delegate getSupplierById to SuppliersService with supplierId', async () => {
      mockSuppliersService.getSupplierById.mockResolvedValue(mockSupplier);

      const mockRequest = {
         headers: {
            [CORRELATION_ID_HEADER]: 'corr-456',
         },
      } as unknown as Request;

      const result = await controller.getSupplierById(mockSupplier.supplierId, mockRequest);

      expect(mockSuppliersService.getSupplierById).toHaveBeenCalledWith(
         mockSupplier.supplierId,
         expect.objectContaining({ correlationId: 'corr-456' }),
      );
      expect(result).toEqual(mockSupplier);
   });

   it('should delegate updateSupplier to SuppliersService with supplierId and dto', async () => {
      const updatedSupplier = { ...mockSupplier, supplierName: 'Mega Market Updated' };
      mockSuppliersService.updateSupplier.mockResolvedValue(updatedSupplier);

      const mockRequest = {
         headers: {
            [CORRELATION_ID_HEADER]: 'corr-456',
         },
      } as unknown as Request;

      const mockUser = {
         sub: 'acc-123',
         email: 'test@example.com',
      } as never;

      const result = await controller.updateSupplier(
         mockSupplier.supplierId,
         { supplierName: 'Mega Market Updated' },
         mockRequest,
         mockUser,
      );

      expect(mockSuppliersService.updateSupplier).toHaveBeenCalledWith(
         mockSupplier.supplierId,
         { supplierName: 'Mega Market Updated' },
         expect.objectContaining({
            correlationId: 'corr-456',
            accountId: 'acc-123',
         }),
      );
      expect(result).toEqual(updatedSupplier);
   });

   it('should delegate verifySupplier to SuppliersService with supplierId and isVerified status', async () => {
      const verifiedSupplier = { ...mockSupplier, isVerified: true };
      mockSuppliersService.verifySupplier.mockResolvedValue(verifiedSupplier);

      const mockRequest = {
         headers: {
            [CORRELATION_ID_HEADER]: 'corr-456',
         },
      } as unknown as Request;

      const mockUser = {
         sub: 'admin-1',
         roles: [DEFAULT_ROLES.ADMIN],
      } as never;

      const result = await controller.verifySupplier(
         mockSupplier.supplierId,
         { isVerified: true },
         mockRequest,
         mockUser,
      );

      expect(mockSuppliersService.verifySupplier).toHaveBeenCalledWith(
         mockSupplier.supplierId,
         true,
         expect.objectContaining({
            correlationId: 'corr-456',
            accountId: 'admin-1',
         }),
      );
      expect(result).toEqual(verifiedSupplier);
   });

   it('should delegate updateSupplierStatus to SuppliersService with supplierId and status', async () => {
      const statusUpdatedSupplier = { ...mockSupplier, supplierStatus: SUPPLIER_STATUS.SUSPENDED };
      mockSuppliersService.updateSupplierStatus.mockResolvedValue(statusUpdatedSupplier);

      const mockRequest = {
         headers: {
            [CORRELATION_ID_HEADER]: 'corr-456',
         },
      } as unknown as Request;

      const mockUser = {
         sub: 'admin-1',
         roles: [DEFAULT_ROLES.ADMIN],
      } as never;

      const result = await controller.updateSupplierStatus(
         mockSupplier.supplierId,
         { status: SUPPLIER_STATUS.SUSPENDED },
         mockRequest,
         mockUser,
      );

      expect(mockSuppliersService.updateSupplierStatus).toHaveBeenCalledWith(
         mockSupplier.supplierId,
         SUPPLIER_STATUS.SUSPENDED,
         expect.objectContaining({
            correlationId: 'corr-456',
            accountId: 'admin-1',
         }),
      );
      expect(result).toEqual(statusUpdatedSupplier);
   });
});
