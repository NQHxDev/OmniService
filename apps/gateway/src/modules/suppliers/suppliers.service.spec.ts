import { Test, TestingModule } from '@nestjs/testing';
import type { ClientGrpc } from '@nestjs/microservices';
import { of } from 'rxjs';
import { DEFAULT_ROLES } from '@common';
import {
   SUPPLIER_MEMBER_STATUS,
   SUPPLIER_ROLES,
   SUPPLIER_STATUS,
   SUPPLIER_V1_GRPC_CLIENT,
   type ISupplierProto,
   type ISupplierV1GrpcService,
   type SupplierItemDto,
} from '@contracts/supplier';
import { SuppliersService } from '@/modules/suppliers/suppliers.service';

describe('SuppliersService', () => {
   let service: SuppliersService;
   let mockGrpcService: jest.Mocked<ISupplierV1GrpcService>;

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

   const mockSupplierProto: ISupplierProto = {
      supplierId: mockSupplier.supplierId,
      supplierName: mockSupplier.supplierName,
      supplierSlug: mockSupplier.supplierSlug,
      supplierCode: mockSupplier.supplierCode,
      contactEmail: mockSupplier.contactEmail || '',
      contactPhone: mockSupplier.contactPhone || '',
      address: mockSupplier.address || '',
      city: mockSupplier.city || '',
      rating: mockSupplier.rating,
      isVerified: mockSupplier.isVerified,
      supplierStatus: mockSupplier.supplierStatus,
      supplierLogoUrl: mockSupplier.supplierLogoUrl || '',
   };

   beforeEach(async () => {
      mockGrpcService = {
         getSupplierById: jest.fn(),
         getSuppliersByIds: jest.fn(),
         listSuppliers: jest.fn(),
         registerSupplier: jest.fn(),
         getMySupplier: jest.fn(),
         updateSupplier: jest.fn(),
         updateSupplierStatus: jest.fn(),
         verifySupplier: jest.fn(),
      };

      const mockClientGrpc: jest.Mocked<ClientGrpc> = {
         getService: jest.fn().mockReturnValue(mockGrpcService),
         getClientByServiceName: jest.fn(),
      };

      const module: TestingModule = await Test.createTestingModule({
         providers: [SuppliersService, { provide: SUPPLIER_V1_GRPC_CLIENT, useValue: mockClientGrpc }],
      }).compile();

      service = module.get<SuppliersService>(SuppliersService);
      service.onModuleInit();
   });

   it('should call supplier gRPC registerSupplier and map response', async () => {
      mockGrpcService.registerSupplier.mockReturnValue(
         of({
            supplier: mockSupplierProto,
         }),
      );

      const result = await service.registerSupplier(
         {
            supplierName: 'Mega Market',
            supplierCode: 'SUPP-MM',
         },
         {
            correlationId: 'req-123',
            accountId: 'acc-123',
            roles: [SUPPLIER_ROLES.SUPPLIER_ADMIN],
            email: 'admin@supplier.vn',
         },
      );

      expect(mockGrpcService.registerSupplier).toHaveBeenCalledWith(
         expect.objectContaining({
            supplierName: 'Mega Market',
            supplierCode: 'SUPP-MM',
         }),
         expect.any(Object),
      );
      expect(result.supplierId).toBe(mockSupplier.supplierId);
      expect(result.supplierName).toBe('Mega Market');
   });

   it('should call supplier gRPC getMySupplier and map response', async () => {
      mockGrpcService.getMySupplier.mockReturnValue(
         of({
            hasSupplier: true,
            supplier: mockSupplierProto,
            role: SUPPLIER_ROLES.SUPPLIER_ADMIN,
            memberStatus: SUPPLIER_MEMBER_STATUS.ACTIVE,
         }),
      );

      const result = await service.getMySupplier({
         correlationId: 'req-123',
         accountId: 'acc-123',
         roles: [SUPPLIER_ROLES.SUPPLIER_ADMIN],
         email: 'admin@supplier.vn',
      });

      expect(mockGrpcService.getMySupplier).toHaveBeenCalledWith(
         expect.objectContaining({
            accountId: 'acc-123',
         }),
         expect.any(Object),
      );
      expect(result.hasSupplier).toBe(true);
      expect(result.supplier?.supplierId).toBe(mockSupplier.supplierId);
      expect(result.role).toBe(SUPPLIER_ROLES.SUPPLIER_ADMIN);
   });

   it('should call supplier gRPC getSupplierById and map response', async () => {
      mockGrpcService.getSupplierById.mockReturnValue(
         of({
            supplier: mockSupplierProto,
         }),
      );

      const result = await service.getSupplierById(mockSupplier.supplierId, {
         correlationId: 'req-123',
      });

      expect(mockGrpcService.getSupplierById).toHaveBeenCalledWith(
         { supplierId: mockSupplier.supplierId },
         expect.any(Object),
      );
      expect(result.supplierId).toBe(mockSupplier.supplierId);
      expect(result.supplierName).toBe('Mega Market');
   });

   it('should call supplier gRPC listSuppliers and map response', async () => {
      mockGrpcService.listSuppliers.mockReturnValue(
         of({
            suppliers: [mockSupplierProto],
            total: 1,
         }),
      );

      const result = await service.listSuppliers(
         {
            status: SUPPLIER_STATUS.ACTIVE,
            limit: 10,
            offset: 0,
         },
         { correlationId: 'req-123' },
      );

      expect(mockGrpcService.listSuppliers).toHaveBeenCalledWith(
         expect.objectContaining({
            status: SUPPLIER_STATUS.ACTIVE,
            limit: 10,
            offset: 0,
         }),
         expect.any(Object),
      );
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
   });

   it('should call supplier gRPC updateSupplier and map response', async () => {
      mockGrpcService.updateSupplier.mockReturnValue(
         of({
            supplier: {
               ...mockSupplierProto,
               supplierName: 'Mega Market Updated',
            },
         }),
      );

      const result = await service.updateSupplier(
         mockSupplier.supplierId,
         {
            supplierName: 'Mega Market Updated',
         },
         { correlationId: 'req-123', accountId: 'acc-123' },
      );

      expect(mockGrpcService.updateSupplier).toHaveBeenCalledWith(
         expect.objectContaining({
            supplierId: mockSupplier.supplierId,
            supplierName: 'Mega Market Updated',
         }),
         expect.any(Object),
      );
      expect(result.supplierName).toBe('Mega Market Updated');
   });

   it('should call supplier gRPC verifySupplier and map response', async () => {
      mockGrpcService.verifySupplier.mockReturnValue(
         of({
            supplier: {
               ...mockSupplierProto,
               isVerified: true,
            },
         }),
      );

      const result = await service.verifySupplier(mockSupplier.supplierId, true, {
         correlationId: 'req-123',
         roles: [DEFAULT_ROLES.ADMIN],
      });

      expect(mockGrpcService.verifySupplier).toHaveBeenCalledWith(
         {
            supplierId: mockSupplier.supplierId,
            isVerified: true,
         },
         expect.any(Object),
      );
      expect(result.isVerified).toBe(true);
   });

   it('should call supplier gRPC updateSupplierStatus and map response', async () => {
      mockGrpcService.updateSupplierStatus.mockReturnValue(
         of({
            supplier: {
               ...mockSupplierProto,
               supplierStatus: SUPPLIER_STATUS.SUSPENDED,
            },
         }),
      );

      const result = await service.updateSupplierStatus(mockSupplier.supplierId, SUPPLIER_STATUS.SUSPENDED, {
         correlationId: 'req-123',
         roles: [DEFAULT_ROLES.ADMIN],
      });

      expect(mockGrpcService.updateSupplierStatus).toHaveBeenCalledWith(
         {
            supplierId: mockSupplier.supplierId,
            status: SUPPLIER_STATUS.SUSPENDED,
         },
         expect.any(Object),
      );
      expect(result.supplierStatus).toBe(SUPPLIER_STATUS.SUSPENDED);
   });
});
