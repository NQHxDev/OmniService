import { Test, TestingModule } from '@nestjs/testing';
import { MERCHANT_TYPE, SUPPLIER_STATUS } from '@contracts/supplier';
import { SupplierService } from '@supplier/services/supplier.service';
import { SubmitKybCommand } from '@supplier/commands/submit-kyb.command';
import { SubmitKybHandler } from '@supplier/commands/submit-kyb.handler';

describe('SubmitKybHandler', () => {
   let handler: SubmitKybHandler;
   let mockSupplierService: { submitKyb: jest.Mock };

   beforeEach(async () => {
      mockSupplierService = {
         submitKyb: jest.fn(),
      };

      const module: TestingModule = await Test.createTestingModule({
         providers: [SubmitKybHandler, { provide: SupplierService, useValue: mockSupplierService }],
      }).compile();

      handler = module.get<SubmitKybHandler>(SubmitKybHandler);
   });

   it('should execute submitKyb command and return mapped supplier item dto', async () => {
      mockSupplierService.submitKyb.mockResolvedValue({
         supplierId: 'supp-123',
         supplierName: 'Mega Market',
         supplierSlug: 'mega-market',
         supplierCode: 'SUPP-MM',
         rating: 5,
         isVerified: false,
         supplierStatus: SUPPLIER_STATUS.UNDER_REVIEW,
         merchantType: MERCHANT_TYPE.ENTERPRISE,
         businessName: 'Mega Retail JSC',
         taxCode: '0312345678',
         createdAt: new Date(),
         updatedAt: new Date(),
      });

      const dto = {
         merchantType: MERCHANT_TYPE.ENTERPRISE,
         businessName: 'Mega Retail JSC',
         taxCode: '0312345678',
      };
      const command = new SubmitKybCommand('supp-123', dto);
      const result = await handler.execute(command);

      expect(mockSupplierService.submitKyb).toHaveBeenCalledWith('supp-123', dto);
      expect(result.supplierId).toBe('supp-123');
      expect(result.supplierStatus).toBe(SUPPLIER_STATUS.UNDER_REVIEW);
      expect(result.businessName).toBe('Mega Retail JSC');
   });
});
