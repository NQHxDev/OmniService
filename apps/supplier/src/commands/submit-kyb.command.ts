import { Command } from '@common';
import type { SubmitKybDto, SupplierItemDto } from '@contracts/supplier';

export class SubmitKybCommand extends Command<SupplierItemDto> {
   declare readonly _resultType: SupplierItemDto;

   constructor(
      public readonly supplierId: string,
      public readonly dto: SubmitKybDto,
   ) {
      super();
   }
}
