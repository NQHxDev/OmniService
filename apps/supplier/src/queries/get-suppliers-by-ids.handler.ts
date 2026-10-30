import { Injectable } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@common';
import type { SupplierItemDto } from '@contracts/supplier';
import { SupplierService } from '@supplier/services/supplier.service';
import { GetSuppliersByIdsQuery } from '@supplier/queries/get-suppliers-by-ids.query';
import { mapSupplierEntityToDto } from '@supplier/utils';

@Injectable()
@CommandHandler(GetSuppliersByIdsQuery)
export class GetSuppliersByIdsHandler implements ICommandHandler<GetSuppliersByIdsQuery, SupplierItemDto[]> {
   constructor(private readonly supplierService: SupplierService) {}

   async execute(query: GetSuppliersByIdsQuery): Promise<SupplierItemDto[]> {
      const records = await this.supplierService.getSuppliersByIds(query.supplierIds);
      return records.map((s) => mapSupplierEntityToDto(s));
   }
}
