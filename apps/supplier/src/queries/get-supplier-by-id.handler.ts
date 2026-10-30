import { Injectable } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@common';
import type { SupplierItemDto } from '@contracts/supplier';
import { SupplierService } from '@supplier/services/supplier.service';
import { GetSupplierByIdQuery } from '@supplier/queries/get-supplier-by-id.query';
import { mapSupplierEntityToDto } from '@supplier/utils';

@Injectable()
@CommandHandler(GetSupplierByIdQuery)
export class GetSupplierByIdHandler implements ICommandHandler<GetSupplierByIdQuery, SupplierItemDto> {
   constructor(private readonly supplierService: SupplierService) {}

   async execute(query: GetSupplierByIdQuery): Promise<SupplierItemDto> {
      const supplier = await this.supplierService.getSupplierById(query.supplierId);
      return mapSupplierEntityToDto(supplier);
   }
}
