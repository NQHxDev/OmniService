import { Injectable } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@common';
import type { SupplierItemDto } from '@contracts/supplier';
import { SupplierService } from '@supplier/services/supplier.service';
import { RejectSupplierCommand } from '@supplier/commands/reject-supplier.command';
import { mapSupplierEntityToDto } from '@supplier/utils';

@Injectable()
@CommandHandler(RejectSupplierCommand)
export class RejectSupplierHandler implements ICommandHandler<RejectSupplierCommand, SupplierItemDto> {
   constructor(private readonly supplierService: SupplierService) {}

   async execute(command: RejectSupplierCommand): Promise<SupplierItemDto> {
      const updated = await this.supplierService.rejectSupplier(command.supplierId, command.reason);
      return mapSupplierEntityToDto(updated);
   }
}
