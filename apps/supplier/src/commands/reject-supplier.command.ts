import { Command } from '@common';
import type { SupplierItemDto } from '@contracts/supplier';

export class RejectSupplierCommand extends Command<SupplierItemDto> {
   declare readonly _resultType: SupplierItemDto;

   constructor(
      public readonly supplierId: string,
      public readonly reason: string,
   ) {
      super();
   }
}
