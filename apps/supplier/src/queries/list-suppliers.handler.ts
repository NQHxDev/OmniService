import { Injectable } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@common';
import type { ListSuppliersResponseDto } from '@contracts/supplier';
import { SupplierService } from '@supplier/services/supplier.service';
import { ListSuppliersQuery } from '@supplier/queries/list-suppliers.query';
import { mapSupplierEntityToDto } from '@supplier/utils';

@Injectable()
@CommandHandler(ListSuppliersQuery)
export class ListSuppliersHandler implements ICommandHandler<ListSuppliersQuery, ListSuppliersResponseDto> {
   constructor(private readonly supplierService: SupplierService) {}

   async execute(query: ListSuppliersQuery): Promise<ListSuppliersResponseDto> {
      const { items, total } = await this.supplierService.listSuppliers({
         status: query.dto.status,
         city: query.dto.city,
         limit: query.dto.limit,
         offset: query.dto.offset,
      });

      return {
         items: items.map((s) => mapSupplierEntityToDto(s)),
         total,
         limit: query.dto.limit ?? 20,
         offset: query.dto.offset ?? 0,
      };
   }
}
