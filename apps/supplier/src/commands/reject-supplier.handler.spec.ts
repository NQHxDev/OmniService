import { Test, TestingModule } from '@nestjs/testing';
import { SUPPLIER_STATUS } from '@contracts/supplier';
import { SupplierService } from '@supplier/services/supplier.service';
import { RejectSupplierCommand } from '@supplier/commands/reject-supplier.command';
import { RejectSupplierHandler } from '@supplier/commands/reject-supplier.handler';

describe('RejectSupplierHandler', () => {
   let handler: RejectSupplierHandler;
   let mockSupplierService: { rejectSupplier: jest.Mock };

   beforeEach(async () => {
      mockSupplierService = {
         rejectSupplier: jest.fn(),
      };

      const module: TestingModule = await Test.createTestingModule({
         providers: [RejectSupplierHandler, { provide: SupplierService, useValue: mockSupplierService }],
      }).compile();

      handler = module.get<RejectSupplierHandler>(RejectSupplierHandler);
   });

   it('should execute rejectSupplier command and return mapped supplier item dto', async () => {
      mockSupplierService.rejectSupplier.mockResolvedValue({
         supplierId: 'supp-123',
         supplierName: 'Mega Market',
         supplierSlug: 'mega-market',
         supplierCode: 'SUPP-MM',
         rating: 5,
         isVerified: false,
         supplierStatus: SUPPLIER_STATUS.REJECTED,
         rejectionReason: 'Invalid business license document',
         createdAt: new Date(),
         updatedAt: new Date(),
      });

      const command = new RejectSupplierCommand('supp-123', 'Invalid business license document');
      const result = await handler.execute(command);

      expect(mockSupplierService.rejectSupplier).toHaveBeenCalledWith('supp-123', 'Invalid business license document');
      expect(result.supplierId).toBe('supp-123');
      expect(result.supplierStatus).toBe(SUPPLIER_STATUS.REJECTED);
      expect(result.rejectionReason).toBe('Invalid business license document');
   });
});
