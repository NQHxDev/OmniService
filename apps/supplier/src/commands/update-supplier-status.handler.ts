import { Injectable } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@common';
import type { SupplierItemDto, SupplierStatusType } from '@contracts/supplier';
import { SupplierService } from '@supplier/services/supplier.service';
import { UpdateSupplierStatusCommand } from '@supplier/commands/update-supplier-status.command';

@Injectable()
@CommandHandler(UpdateSupplierStatusCommand)
export class UpdateSupplierStatusHandler implements ICommandHandler<UpdateSupplierStatusCommand, SupplierItemDto> {
   constructor(private readonly supplierService: SupplierService) {}

   async execute(command: UpdateSupplierStatusCommand): Promise<SupplierItemDto> {
      const updated = await this.supplierService.updateSupplierStatus(command.supplierId, command.status);
      return {
         supplierId: updated.supplierId,
         supplierName: updated.supplierName,
         supplierSlug: updated.supplierSlug,
         supplierCode: updated.supplierCode,
         contactEmail: updated.contactEmail || undefined,
         contactPhone: updated.contactPhone || undefined,
         address: updated.address || undefined,
         city: updated.city || undefined,
         rating: updated.rating,
         isVerified: updated.isVerified,
         supplierStatus: updated.supplierStatus as SupplierStatusType,
         supplierLogoUrl: updated.supplierLogoUrl || undefined,
      };
   }
}
