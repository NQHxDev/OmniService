import { Test, TestingModule } from '@nestjs/testing';
import type { ExecutionContext } from '@nestjs/common';
import { DEFAULT_ROLES, ForbiddenException } from '@common';
import { SUPPLIER_STATUS } from '@contracts/supplier';
import { SuppliersService } from '@/modules/suppliers/suppliers.service';
import { VerifiedSupplierGuard } from '@/modules/suppliers/guards/verified-supplier.guard';

describe('VerifiedSupplierGuard', () => {
   let guard: VerifiedSupplierGuard;
   const mockSuppliersService = {
      getMySupplier: jest.fn(),
   };

   const createMockContext = (user?: any, headers: Record<string, string> = {}): ExecutionContext => {
      const req = {
         user,
         headers,
      };
      return {
         switchToHttp: () => ({
            getRequest: () => req,
         }),
      } as unknown as ExecutionContext;
   };

   beforeEach(async () => {
      jest.clearAllMocks();

      const module: TestingModule = await Test.createTestingModule({
         providers: [VerifiedSupplierGuard, { provide: SuppliersService, useValue: mockSuppliersService }],
      }).compile();

      guard = module.get<VerifiedSupplierGuard>(VerifiedSupplierGuard);
   });

   it('should return false if user context is missing', async () => {
      const ctx = createMockContext(undefined);
      const result = await guard.canActivate(ctx);
      expect(result).toBe(false);
   });

   it('should permit platform administrator without querying supplier service', async () => {
      const ctx = createMockContext({ sub: 'admin-id', roles: [DEFAULT_ROLES.ADMIN] });
      const result = await guard.canActivate(ctx);
      expect(result).toBe(true);
      expect(mockSuppliersService.getMySupplier).not.toHaveBeenCalled();
   });

   it('should throw ForbiddenException if user has no supplier store registered', async () => {
      const ctx = createMockContext({ sub: 'user-1', roles: [DEFAULT_ROLES.USER] });
      mockSuppliersService.getMySupplier.mockResolvedValue({
         hasSupplier: false,
         supplier: null,
      });

      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
   });

   it('should throw ForbiddenException if supplier is not verified or not ACTIVE', async () => {
      const ctx = createMockContext({ sub: 'user-1', roles: [DEFAULT_ROLES.USER] });
      mockSuppliersService.getMySupplier.mockResolvedValue({
         hasSupplier: true,
         supplier: {
            supplierId: 'supp-1',
            isVerified: false,
            supplierStatus: SUPPLIER_STATUS.PENDING,
         },
      });

      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
   });

   it('should allow access if supplier store is ACTIVE and verified', async () => {
      const ctx = createMockContext({ sub: 'user-1', roles: [DEFAULT_ROLES.USER] });
      mockSuppliersService.getMySupplier.mockResolvedValue({
         hasSupplier: true,
         supplier: {
            supplierId: 'supp-1',
            isVerified: true,
            supplierStatus: SUPPLIER_STATUS.ACTIVE,
         },
      });

      const result = await guard.canActivate(ctx);
      expect(result).toBe(true);
   });
});
