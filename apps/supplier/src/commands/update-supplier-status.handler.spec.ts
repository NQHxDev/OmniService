import { Test, TestingModule } from '@nestjs/testing';
import { SUPPLIER_STATUS } from '@contracts/supplier';
import { SupplierService } from '@supplier/services/supplier.service';
import { UpdateSupplierStatusCommand } from '@supplier/commands/update-supplier-status.command';
import { UpdateSupplierStatusHandler } from '@supplier/commands/update-supplier-status.handler';

describe('UpdateSupplierStatusHandler', () => {
   let handler: UpdateSupplierStatusHandler;
   let mockSupplierService: { updateSupplierStatus: jest.Mock };

   beforeEach(async () => {
      mockSupplierService = {
         updateSupplierStatus: jest.fn(),
      };

      const module: TestingModule = await Test.createTestingModule({
         providers: [UpdateSupplierStatusHandler, { provide: SupplierService, useValue: mockSupplierService }],
      }).compile();

      handler = module.get<UpdateSupplierStatusHandler>(UpdateSupplierStatusHandler);
   });

   it('should execute command and return mapped supplier dto', async () => {
      mockSupplierService.updateSupplierStatus.mockResolvedValue({
         supplierId: 'supp-123',
         supplierName: 'Mega Market',
         supplierSlug: 'mega-market',
         supplierCode: 'SUPP-MM',
         contactEmail: 'contact@example.com',
         contactPhone: '0901234567',
         address: '123 Street',
         city: 'HCM',
         rating: 5,
         isVerified: true,
         supplierStatus: SUPPLIER_STATUS.SUSPENDED,
         supplierLogoUrl: 'https://example.com/logo.png',
      });

      const command = new UpdateSupplierStatusCommand('supp-123', SUPPLIER_STATUS.SUSPENDED);
      const result = await handler.execute(command);

      expect(mockSupplierService.updateSupplierStatus).toHaveBeenCalledWith('supp-123', SUPPLIER_STATUS.SUSPENDED);
      expect(result.supplierId).toBe('supp-123');
      expect(result.supplierStatus).toBe(SUPPLIER_STATUS.SUSPENDED);
   });
});
