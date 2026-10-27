import { Inject, Injectable } from '@nestjs/common';
import { CommandHandler, ConflictException, type ICommandHandler } from '@common';
import {
   SUPPLIER_ERROR_CODES,
   SUPPLIER_MEMBER_STATUS,
   SUPPLIER_ROLES,
   type SupplierItemDto,
} from '@contracts/supplier';
import { SupplierService } from '@supplier/services/supplier.service';
import { RegisterSupplierCommand } from '@supplier/commands/register-supplier.command';
import { SUPPLIER_MEMBER_REPOSITORY, type ISupplierMemberRepository } from '@supplier/repositories';
import { SUPPLIER_EVENT_PUBLISHER, type ISupplierEventPublisher } from '@supplier/publishers';
import { mapSupplierEntityToDto } from '@supplier/utils';

@Injectable()
@CommandHandler(RegisterSupplierCommand)
export class RegisterSupplierHandler implements ICommandHandler<RegisterSupplierCommand, SupplierItemDto> {
   constructor(
      private readonly supplierService: SupplierService,
      @Inject(SUPPLIER_MEMBER_REPOSITORY)
      private readonly supplierMemberRepository: ISupplierMemberRepository,
      @Inject(SUPPLIER_EVENT_PUBLISHER)
      private readonly eventPublisher: ISupplierEventPublisher,
   ) {}

   async execute(command: RegisterSupplierCommand): Promise<SupplierItemDto> {
      let existingMember = null;
      if (command.userId) {
         existingMember = await this.supplierMemberRepository.findByAccountId(command.userId);
         if (existingMember?.supplierId) {
            throw new ConflictException(SUPPLIER_ERROR_CODES.SUPPLIER_ALREADY_EXISTS, {
               params: { accountId: command.userId },
            });
         }
      }

      const created = await this.supplierService.registerSupplier(command.dto);

      if (command.userId) {
         if (existingMember) {
            await this.supplierMemberRepository.update(existingMember.memberId, {
               supplierId: created.supplierId,
            });
         } else {
            await this.supplierMemberRepository.create({
               accountId: command.userId,
               supplierId: created.supplierId,
               email: created.contactEmail || '',
               role: SUPPLIER_ROLES.SUPPLIER_ADMIN,
               memberStatus: SUPPLIER_MEMBER_STATUS.ACTIVE,
               joinedAt: new Date(),
            });
         }

         await this.eventPublisher.publishOnboardingCompleted({
            accountId: command.userId,
            supplierId: created.supplierId,
            role: SUPPLIER_ROLES.SUPPLIER_ADMIN,
            email: created.contactEmail || undefined,
            supplierName: created.supplierName,
         });
      }

      return mapSupplierEntityToDto(created);
   }
}
