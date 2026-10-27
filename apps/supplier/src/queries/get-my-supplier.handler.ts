import { Inject, Injectable, Logger } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@common';
import { SUPPLIER_MEMBER_REPOSITORY, type ISupplierMemberRepository } from '@supplier/repositories';
import { SupplierService } from '@supplier/services/supplier.service';
import { GetMySupplierQuery, type MySupplierQueryResult } from '@supplier/queries/get-my-supplier.query';
import { mapSupplierEntityToDto } from '@supplier/utils';

@Injectable()
@CommandHandler(GetMySupplierQuery)
export class GetMySupplierHandler implements ICommandHandler<GetMySupplierQuery, MySupplierQueryResult> {
   private readonly logger = new Logger(GetMySupplierHandler.name);

   constructor(
      @Inject(SUPPLIER_MEMBER_REPOSITORY)
      private readonly supplierMemberRepository: ISupplierMemberRepository,
      private readonly supplierService: SupplierService,
   ) {}

   async execute(query: GetMySupplierQuery): Promise<MySupplierQueryResult> {
      if (!query.accountId) {
         return {
            hasSupplier: false,
            supplier: null,
         };
      }

      const member = await this.supplierMemberRepository.findByAccountId(query.accountId);
      if (!member || !member.supplierId) {
         return {
            hasSupplier: false,
            supplier: null,
            role: member?.role,
            memberStatus: member?.memberStatus,
         };
      }

      try {
         const supplier = await this.supplierService.getSupplierById(member.supplierId);
         return {
            hasSupplier: true,
            supplier: mapSupplierEntityToDto(supplier),
            role: member.role,
            memberStatus: member.memberStatus,
         };
      } catch (err) {
         this.logger.warn(`Could not find supplier ${member.supplierId} for member ${member.memberId}`, err);
         return {
            hasSupplier: false,
            supplier: null,
            role: member.role,
            memberStatus: member.memberStatus,
         };
      }
   }
}
