import { Injectable } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@common';
import type { SupplierItemDto } from '@contracts/supplier';
import { SupplierService } from '@supplier/services/supplier.service';
import { VerifySupplierCommand } from '@supplier/commands/verify-supplier.command';
import { mapSupplierEntityToDto } from '@supplier/utils';

@Injectable()
@CommandHandler(VerifySupplierCommand)
export class VerifySupplierHandler implements ICommandHandler<VerifySupplierCommand, SupplierItemDto> {
   constructor(private readonly supplierService: SupplierService) {}

   async execute(command: VerifySupplierCommand): Promise<SupplierItemDto> {
      const updated = await this.supplierService.verifySupplier(command.supplierId, command.isVerified);
      return mapSupplierEntityToDto(updated);
   }
}
