import { Test, TestingModule } from '@nestjs/testing';
import { CommandBus, createGrpcMetadata, DEFAULT_ROLES, ForbiddenException, UnauthorizedException } from '@common';
import { SUPPLIER_MEMBER_STATUS, SUPPLIER_ROLES, SUPPLIER_STATUS, type SupplierItemDto } from '@contracts/supplier';
import { SupplierGrpcController } from '@supplier/adapters/grpc/supplier-grpc.controller';
import { SUPPLIER_MEMBER_REPOSITORY } from '@supplier/repositories';
import { firstValueFrom } from 'rxjs';

describe('SupplierGrpcController', () => {
   let controller: SupplierGrpcController;
   let mockCommandBus: jest.Mocked<CommandBus>;

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
      mockCommandBus = {
         execute: jest.fn(),
      } as unknown as jest.Mocked<CommandBus>;

      const mockSupplierMemberRepository = {
         findByAccountId: jest.fn(),
      };

      const module: TestingModule = await Test.createTestingModule({
         controllers: [SupplierGrpcController],
         providers: [
            { provide: CommandBus, useValue: mockCommandBus },
            { provide: SUPPLIER_MEMBER_REPOSITORY, useValue: mockSupplierMemberRepository },
         ],
      }).compile();

      controller = module.get<SupplierGrpcController>(SupplierGrpcController);
   });

   it('should throw UnauthorizedException when registering supplier without user metadata', () => {
      const request = {
         supplierName: 'Mega Market',
         supplierCode: 'SUPP-MM',
         contactEmail: 'contact@megamarket.vn',
         contactPhone: '0901234567',
         address: 'An Phu',
         city: 'Ho Chi Minh',
         supplierLogoUrl: 'https://example.com/logo.png',
      };

      expect(() => controller.registerSupplier(request)).toThrow(UnauthorizedException);
   });

   it('should extract accountId from metadata when registering supplier', async () => {
      mockCommandBus.execute.mockResolvedValue(mockSupplier);

      const request = {
         supplierName: 'Mega Market',
         supplierCode: 'SUPP-MM',
         contactEmail: 'contact@megamarket.vn',
         contactPhone: '0901234567',
         address: 'An Phu',
         city: 'Ho Chi Minh',
         supplierLogoUrl: 'https://example.com/logo.png',
      };

      const mockMetadata = createGrpcMetadata({ userId: 'user-meta-123' });

      const response$ = controller.registerSupplier(request, mockMetadata);
      const result = await firstValueFrom(response$);

      expect(mockCommandBus.execute).toHaveBeenCalledWith(
         expect.objectContaining({
            userId: 'user-meta-123',
         }),
      );
      expect(result.supplier.supplierId).toBe(mockSupplier.supplierId);
      expect(result.supplier.supplierName).toBe(mockSupplier.supplierName);
   });

   it('should execute GetMySupplierQuery when calling getMySupplier with accountId in request', async () => {
      mockCommandBus.execute.mockResolvedValue({
         hasSupplier: true,
         supplier: mockSupplier,
         role: SUPPLIER_ROLES.SUPPLIER_ADMIN,
         memberStatus: SUPPLIER_MEMBER_STATUS.ACTIVE,
      });

      const request = { accountId: 'acc-123' };
      const response$ = controller.getMySupplier(request);
      const result = await firstValueFrom(response$);

      expect(result.hasSupplier).toBe(true);
      expect(result.supplier?.supplierId).toBe(mockSupplier.supplierId);
      expect(result.role).toBe(SUPPLIER_ROLES.SUPPLIER_ADMIN);
   });

   it('should extract accountId from metadata when calling getMySupplier without accountId in request', async () => {
      mockCommandBus.execute.mockResolvedValue({
         hasSupplier: true,
         supplier: mockSupplier,
         role: SUPPLIER_ROLES.SUPPLIER_ADMIN,
         memberStatus: SUPPLIER_MEMBER_STATUS.ACTIVE,
      });

      const mockMetadata = createGrpcMetadata({ accountId: 'acc-from-metadata' });

      const request = {};
      const response$ = controller.getMySupplier(request, mockMetadata);
      const result = await firstValueFrom(response$);

      expect(result.hasSupplier).toBe(true);
      expect(mockCommandBus.execute).toHaveBeenCalledWith(
         expect.objectContaining({
            accountId: 'acc-from-metadata',
         }),
      );
   });

   it('should throw UnauthorizedException when calling getMySupplier without accountId or metadata', () => {
      const request = {};
      expect(() => controller.getMySupplier(request)).toThrow(UnauthorizedException);
   });

   describe('updateSupplier', () => {
      it('should execute UpdateSupplierCommand without supplierStatus for member', async () => {
         mockCommandBus.execute.mockResolvedValue(mockSupplier);

         const mockMetadata = createGrpcMetadata({
            userId: 'member-1',
            roles: [DEFAULT_ROLES.USER],
         });

         const mockMemberRepo = (controller as unknown as { supplierMemberRepository: { findByAccountId: jest.Mock } })
            .supplierMemberRepository;
         mockMemberRepo.findByAccountId = jest.fn().mockResolvedValue({
            supplierId: mockSupplier.supplierId,
            memberStatus: SUPPLIER_MEMBER_STATUS.ACTIVE,
         });

         const request = {
            supplierId: mockSupplier.supplierId,
            supplierName: 'New Name',
         };

         const response$ = controller.updateSupplier(request, mockMetadata);
         const result = await firstValueFrom(response$);

         expect(mockCommandBus.execute).toHaveBeenCalledWith(
            expect.objectContaining({
               supplierId: mockSupplier.supplierId,
               dto: {
                  supplierName: 'New Name',
                  contactEmail: undefined,
                  contactPhone: undefined,
                  address: undefined,
                  city: undefined,
                  supplierLogoUrl: undefined,
               },
            }),
         );
         expect(result.supplier.supplierId).toBe(mockSupplier.supplierId);
      });
   });

   describe('updateSupplierStatus', () => {
      it('should throw ForbiddenException if caller is not ADMIN', () => {
         const mockMetadata = createGrpcMetadata({
            userId: 'user-1',
            roles: [DEFAULT_ROLES.USER],
         });

         const request = {
            supplierId: mockSupplier.supplierId,
            status: SUPPLIER_STATUS.ACTIVE,
         };

         expect(() => controller.updateSupplierStatus(request, mockMetadata)).toThrow(ForbiddenException);
      });

      it('should execute UpdateSupplierStatusCommand when caller is ADMIN', async () => {
         mockCommandBus.execute.mockResolvedValue(mockSupplier);

         const mockMetadata = createGrpcMetadata({
            userId: 'admin-1',
            roles: [DEFAULT_ROLES.ADMIN],
         });

         const request = {
            supplierId: mockSupplier.supplierId,
            status: SUPPLIER_STATUS.ACTIVE,
         };

         const response$ = controller.updateSupplierStatus(request, mockMetadata);
         const result = await firstValueFrom(response$);

         expect(mockCommandBus.execute).toHaveBeenCalledWith(
            expect.objectContaining({
               supplierId: mockSupplier.supplierId,
               status: SUPPLIER_STATUS.ACTIVE,
            }),
         );
         expect(result.supplier.supplierId).toBe(mockSupplier.supplierId);
      });
   });
});
