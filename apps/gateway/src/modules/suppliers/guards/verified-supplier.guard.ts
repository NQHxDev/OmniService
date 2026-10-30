import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { CORRELATION_ID_HEADER, DEFAULT_ROLES, ForbiddenException, type JwtPayload } from '@common';
import { SUPPLIER_ERROR_CODES, SUPPLIER_ERROR_REASONS, SUPPLIER_STATUS } from '@contracts/supplier';
import { SuppliersService } from '@/modules/suppliers/suppliers.service';

@Injectable()
export class VerifiedSupplierGuard implements CanActivate {
   constructor(private readonly suppliersService: SuppliersService) {}

   async canActivate(context: ExecutionContext): Promise<boolean> {
      const request = context.switchToHttp().getRequest<Request & { user?: JwtPayload }>();
      const user = request.user;

      if (!user) {
         return false;
      }

      // Platform administrators bypass supplier onboarding verification check
      if (user.roles?.includes(DEFAULT_ROLES.ADMIN)) {
         return true;
      }

      const correlationId = (request.headers[CORRELATION_ID_HEADER] as string) || undefined;
      const mySupplier = await this.suppliersService.getMySupplier({
         correlationId,
         accountId: user.sub,
         roles: user.roles,
         permissions: user.permissions,
         email: user.email,
      });

      if (!mySupplier.hasSupplier || !mySupplier.supplier) {
         throw new ForbiddenException(SUPPLIER_ERROR_CODES.SUPPLIER_NOT_VERIFIED, {
            params: { accountId: user.sub, reason: SUPPLIER_ERROR_REASONS.NO_SUPPLIER_STORE },
         });
      }

      const supplier = mySupplier.supplier;
      if (!supplier.isVerified || supplier.supplierStatus !== SUPPLIER_STATUS.ACTIVE) {
         throw new ForbiddenException(SUPPLIER_ERROR_CODES.SUPPLIER_NOT_VERIFIED, {
            params: {
               supplierId: supplier.supplierId,
               supplierStatus: supplier.supplierStatus,
               isVerified: supplier.isVerified,
            },
         });
      }

      return true;
   }
}
