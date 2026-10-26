import { Command } from '@common';
import type { SupplierItemDto, SupplierStatusType } from '@contracts/supplier';

export class UpdateSupplierStatusCommand extends Command<SupplierItemDto> {
   constructor(
      public readonly supplierId: string,
      public readonly status: SupplierStatusType,
   ) {
      super();
   }
}
