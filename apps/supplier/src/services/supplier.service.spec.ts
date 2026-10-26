import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BadRequestException, ConflictException, NotFoundException } from '@common';
import { SUPPLIER_EVENTS, SUPPLIER_STATUS, type SupplierStatusType } from '@contracts/supplier';
import { SUPPLIER_REPOSITORY } from '@supplier/repositories';
import { SupplierService } from '@supplier/services/supplier.service';

describe('SupplierService', () => {
   let service: SupplierService;

   const mockSupplierRepo = {
      findById: jest.fn(),
      findByIds: jest.fn(),
      findByCode: jest.fn(),
      findBySlug: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
   };

   const mockEventEmitter = {
      emit: jest.fn(),
   };

   beforeEach(async () => {
      jest.clearAllMocks();

      const module: TestingModule = await Test.createTestingModule({
         providers: [
            SupplierService,
            { provide: SUPPLIER_REPOSITORY, useValue: mockSupplierRepo },
            { provide: EventEmitter2, useValue: mockEventEmitter },
         ],
      }).compile();

      service = module.get<SupplierService>(SupplierService);
   });

   it('should register a new supplier successfully', async () => {
      mockSupplierRepo.findByCode.mockResolvedValue(null);
      mockSupplierRepo.findBySlug.mockResolvedValue(null);
      mockSupplierRepo.create.mockResolvedValue({
         supplierId: '0192e21b-0003-7000-8000-000000000001',
         supplierName: 'Mega Market',
         supplierCode: 'SUPP-MM',
         supplierSlug: 'mega-market',
         rating: 5,
         isVerified: false,
         supplierStatus: SUPPLIER_STATUS.ACTIVE,
         version: 1,
         deletedAt: null,
         createdAt: new Date(),
         updatedAt: new Date(),
      });

      const result = await service.registerSupplier({
         supplierName: 'Mega Market',
         supplierCode: 'SUPP-MM',
      });

      expect(result.supplierId).toBe('0192e21b-0003-7000-8000-000000000001');
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(SUPPLIER_EVENTS.SUPPLIER_REGISTERED, expect.anything());
   });

   it('should auto-generate supplier code when omitted', async () => {
      mockSupplierRepo.findByCode.mockResolvedValue(null);
      mockSupplierRepo.findBySlug.mockResolvedValue(null);
      mockSupplierRepo.create.mockImplementation((data) =>
         Promise.resolve({
            supplierId: 'supp-auto-1',
            ...data,
            rating: 5,
            version: 1,
            deletedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
         }),
      );

      const result = await service.registerSupplier({
         supplierName: 'Fresh Greens',
      });

      expect(result.supplierId).toBe('supp-auto-1');
      expect(result.supplierCode).toMatch(/^SUP-/);
   });

   it('should throw ConflictException if supplier code already exists', async () => {
      mockSupplierRepo.findByCode.mockResolvedValue({ supplierId: 'existing' });

      await expect(
         service.registerSupplier({
            supplierName: 'Mega Market',
            supplierCode: 'SUPP-MM',
         }),
      ).rejects.toThrow(ConflictException);
   });

   it('should retrieve supplier by ID or throw NotFoundException', async () => {
      mockSupplierRepo.findById.mockResolvedValue(null);

      await expect(service.getSupplierById('non-existent')).rejects.toThrow(NotFoundException);
   });

   it('should verify supplier and emit event', async () => {
      mockSupplierRepo.findById.mockResolvedValue({
         supplierId: 'supp-1',
         isVerified: false,
      });
      mockSupplierRepo.update.mockResolvedValue({
         supplierId: 'supp-1',
         isVerified: true,
      });

      const result = await service.verifySupplier('supp-1', true);
      expect(result.isVerified).toBe(true);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(SUPPLIER_EVENTS.SUPPLIER_VERIFIED, expect.anything());
   });

   it('should update supplier profile without modifying status', async () => {
      mockSupplierRepo.findById.mockResolvedValue({
         supplierId: 'supp-1',
         supplierName: 'Mega Market',
         supplierStatus: SUPPLIER_STATUS.SUSPENDED,
      });
      mockSupplierRepo.update.mockResolvedValue({
         supplierId: 'supp-1',
         supplierName: 'Mega Market Updated',
         supplierStatus: SUPPLIER_STATUS.SUSPENDED,
      });

      const result = await service.updateSupplier('supp-1', {
         supplierName: 'Mega Market Updated',
      });

      expect(mockSupplierRepo.update).toHaveBeenCalledWith('supp-1', {
         supplierName: 'Mega Market Updated',
         supplierSlug: 'mega-market-updated',
         contactEmail: undefined,
         contactPhone: undefined,
         address: undefined,
         city: undefined,
         supplierLogoUrl: undefined,
      });
      expect(result.supplierName).toBe('Mega Market Updated');
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(SUPPLIER_EVENTS.SUPPLIER_UPDATED, expect.anything());
      expect(mockEventEmitter.emit).not.toHaveBeenCalledWith(
         SUPPLIER_EVENTS.SUPPLIER_STATUS_CHANGED,
         expect.anything(),
      );
   });

   describe('updateSupplierStatus', () => {
      it('should throw BadRequestException for invalid status', async () => {
         await expect(service.updateSupplierStatus('supp-1', 'INVALID_STATUS' as SupplierStatusType)).rejects.toThrow(
            BadRequestException,
         );
      });

      it('should throw NotFoundException if supplier not found', async () => {
         mockSupplierRepo.findById.mockResolvedValue(null);

         await expect(service.updateSupplierStatus('supp-1', SUPPLIER_STATUS.ACTIVE)).rejects.toThrow(
            NotFoundException,
         );
      });

      it('should return existing supplier if status is unchanged', async () => {
         mockSupplierRepo.findById.mockResolvedValue({
            supplierId: 'supp-1',
            supplierStatus: SUPPLIER_STATUS.ACTIVE,
         });

         const result = await service.updateSupplierStatus('supp-1', SUPPLIER_STATUS.ACTIVE);
         expect(result.supplierStatus).toBe(SUPPLIER_STATUS.ACTIVE);
         expect(mockSupplierRepo.update).not.toHaveBeenCalled();
         expect(mockEventEmitter.emit).not.toHaveBeenCalled();
      });

      it('should update status and emit SUPPLIER_STATUS_CHANGED when transitioning status', async () => {
         mockSupplierRepo.findById.mockResolvedValue({
            supplierId: 'supp-1',
            supplierStatus: SUPPLIER_STATUS.SUSPENDED,
         });
         mockSupplierRepo.update.mockResolvedValue({
            supplierId: 'supp-1',
            supplierStatus: SUPPLIER_STATUS.ACTIVE,
         });

         const result = await service.updateSupplierStatus('supp-1', SUPPLIER_STATUS.ACTIVE);
         expect(mockSupplierRepo.update).toHaveBeenCalledWith('supp-1', {
            supplierStatus: SUPPLIER_STATUS.ACTIVE,
         });
         expect(result.supplierStatus).toBe(SUPPLIER_STATUS.ACTIVE);
         expect(mockEventEmitter.emit).toHaveBeenCalledWith(
            SUPPLIER_EVENTS.SUPPLIER_STATUS_CHANGED,
            expect.objectContaining({
               supplierId: 'supp-1',
               previousStatus: SUPPLIER_STATUS.SUSPENDED,
               newStatus: SUPPLIER_STATUS.ACTIVE,
            }),
         );
      });
   });
});
