import { Injectable } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@common';
import type { SupplierItemDto } from '@contracts/supplier';
import { SupplierService } from '@supplier/services/supplier.service';
import { SubmitKybCommand } from '@supplier/commands/submit-kyb.command';
import { mapSupplierEntityToDto } from '@supplier/utils';

@Injectable()
@CommandHandler(SubmitKybCommand)
export class SubmitKybHandler implements ICommandHandler<SubmitKybCommand, SupplierItemDto> {
   constructor(private readonly supplierService: SupplierService) {}

   async execute(command: SubmitKybCommand): Promise<SupplierItemDto> {
      const updated = await this.supplierService.submitKyb(command.supplierId, command.dto);
      return mapSupplierEntityToDto(updated);
   }
}
