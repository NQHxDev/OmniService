import { Controller, Inject, UseFilters, UseInterceptors } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import type { Metadata } from '@grpc/grpc-js';
import { from, type Observable } from 'rxjs';
import {
   checkRoles,
   COMMON_ERROR_CODES,
   CommandBus,
   DEFAULT_ROLES,
   extractGrpcUser,
   ForbiddenException,
   GrpcExceptionFilter,
   GrpcLoggingInterceptor,
   GrpcMetricsInterceptor,
   isActorAdmin,
   UnauthorizedException,
} from '@common';
import {
   SUPPLIER_MEMBER_STATUS,
   SUPPLIER_V1_GRPC_METHODS,
   SUPPLIER_V1_GRPC_SERVICE_NAME,
   type IGetMySupplierRequest,
   type IGetMySupplierResponse,
   type IGetSupplierByIdRequest,
   type IGetSupplierByIdResponse,
   type IGetSuppliersByIdsRequest,
   type IGetSuppliersByIdsResponse,
   type IListSuppliersRequest,
   type IListSuppliersResponse,
   type IRegisterSupplierRequest,
   type IRegisterSupplierResponse,
   type ISupplierProto,
   type ISupplierV1GrpcService,
   type IUpdateSupplierRequest,
   type IUpdateSupplierResponse,
   type IUpdateSupplierStatusRequest,
   type IUpdateSupplierStatusResponse,
   type IVerifySupplierRequest,
   type IVerifySupplierResponse,
   type SupplierItemDto,
   type SupplierStatusType,
} from '@contracts/supplier';
import {
   RegisterSupplierCommand,
   UpdateSupplierCommand,
   UpdateSupplierStatusCommand,
   VerifySupplierCommand,
} from '@supplier/commands';
import {
   GetMySupplierQuery,
   GetSupplierByIdQuery,
   GetSuppliersByIdsQuery,
   ListSuppliersQuery,
} from '@supplier/queries';
import { SUPPLIER_MEMBER_REPOSITORY, type ISupplierMemberRepository } from '@supplier/repositories';

@Controller()
@UseFilters(new GrpcExceptionFilter())
@UseInterceptors(GrpcLoggingInterceptor, GrpcMetricsInterceptor)
export class SupplierGrpcController implements ISupplierV1GrpcService {
   constructor(
      private readonly commandBus: CommandBus,
      @Inject(SUPPLIER_MEMBER_REPOSITORY)
      private readonly supplierMemberRepository: ISupplierMemberRepository,
   ) {}

   private extractAccountId(metadata?: Metadata, fallbackAccountId?: string): string {
      const user = extractGrpcUser(metadata);
      const resolved = user?.userId || fallbackAccountId;
      if (!resolved) {
         throw new UnauthorizedException(COMMON_ERROR_CODES.UNAUTHORIZED);
      }
      return resolved;
   }

   private mapSupplierToProto(supplier: SupplierItemDto): ISupplierProto {
      return {
         supplierId: supplier.supplierId,
         supplierName: supplier.supplierName,
         supplierSlug: supplier.supplierSlug,
         supplierCode: supplier.supplierCode,
         contactEmail: supplier.contactEmail || '',
         contactPhone: supplier.contactPhone || '',
         address: supplier.address || '',
         city: supplier.city || '',
         rating: supplier.rating,
         isVerified: supplier.isVerified,
         supplierStatus: supplier.supplierStatus,
         supplierLogoUrl: supplier.supplierLogoUrl || '',
      };
   }

   @GrpcMethod(SUPPLIER_V1_GRPC_SERVICE_NAME, SUPPLIER_V1_GRPC_METHODS.GET_SUPPLIER_BY_ID)
   getSupplierById(data: IGetSupplierByIdRequest): Observable<IGetSupplierByIdResponse> {
      return from(
         this.commandBus.execute(new GetSupplierByIdQuery(data.supplierId)).then((supplier) => ({
            supplier: this.mapSupplierToProto(supplier),
         })),
      );
   }

   @GrpcMethod(SUPPLIER_V1_GRPC_SERVICE_NAME, SUPPLIER_V1_GRPC_METHODS.GET_SUPPLIERS_BY_IDS)
   getSuppliersByIds(data: IGetSuppliersByIdsRequest): Observable<IGetSuppliersByIdsResponse> {
      return from(
         this.commandBus.execute(new GetSuppliersByIdsQuery(data.supplierIds)).then((suppliers) => ({
            suppliers: suppliers.map((s) => this.mapSupplierToProto(s)),
         })),
      );
   }

   @GrpcMethod(SUPPLIER_V1_GRPC_SERVICE_NAME, SUPPLIER_V1_GRPC_METHODS.LIST_SUPPLIERS)
   listSuppliers(data: IListSuppliersRequest): Observable<IListSuppliersResponse> {
      return from(
         this.commandBus
            .execute(
               new ListSuppliersQuery({
                  status: data.status as never,
                  city: data.city,
                  limit: data.limit,
                  offset: data.offset,
               }),
            )
            .then((result) => ({
               suppliers: result.items.map((s) => this.mapSupplierToProto(s)),
               total: result.total,
            })),
      );
   }

   @GrpcMethod(SUPPLIER_V1_GRPC_SERVICE_NAME, SUPPLIER_V1_GRPC_METHODS.REGISTER_SUPPLIER)
   registerSupplier(data: IRegisterSupplierRequest, metadata?: Metadata): Observable<IRegisterSupplierResponse> {
      const accountId = this.extractAccountId(metadata);

      return from(
         this.commandBus
            .execute(
               new RegisterSupplierCommand(
                  {
                     supplierName: data.supplierName,
                     supplierCode: data.supplierCode,
                     contactEmail: data.contactEmail,
                     contactPhone: data.contactPhone,
                     address: data.address,
                     city: data.city,
                     supplierLogoUrl: data.supplierLogoUrl,
                  },
                  accountId,
               ),
            )
            .then((supplier) => ({
               supplier: this.mapSupplierToProto(supplier),
            })),
      );
   }

   @GrpcMethod(SUPPLIER_V1_GRPC_SERVICE_NAME, SUPPLIER_V1_GRPC_METHODS.GET_MY_SUPPLIER)
   getMySupplier(data: IGetMySupplierRequest, metadata?: Metadata): Observable<IGetMySupplierResponse> {
      const accountId = this.extractAccountId(metadata, data.accountId);

      return from(
         this.commandBus.execute(new GetMySupplierQuery(accountId)).then((result) => ({
            hasSupplier: result.hasSupplier,
            supplier: result.supplier ? this.mapSupplierToProto(result.supplier) : undefined,
            role: result.role,
            memberStatus: result.memberStatus,
         })),
      );
   }

   @GrpcMethod(SUPPLIER_V1_GRPC_SERVICE_NAME, SUPPLIER_V1_GRPC_METHODS.UPDATE_SUPPLIER)
   updateSupplier(data: IUpdateSupplierRequest, metadata?: Metadata): Observable<IUpdateSupplierResponse> {
      return from(
         (async () => {
            if (!isActorAdmin(metadata)) {
               const user = extractGrpcUser(metadata);
               if (!user) {
                  throw new UnauthorizedException(COMMON_ERROR_CODES.MISSING_USER_CONTEXT);
               }
               const member = await this.supplierMemberRepository.findByAccountId(user.userId);
               if (
                  !member ||
                  member.supplierId !== data.supplierId ||
                  member.memberStatus !== SUPPLIER_MEMBER_STATUS.ACTIVE
               ) {
                  throw new ForbiddenException(COMMON_ERROR_CODES.NOT_OWNER_OR_ADMIN);
               }
            }

            const supplier = await this.commandBus.execute(
               new UpdateSupplierCommand(data.supplierId, {
                  supplierName: data.supplierName,
                  contactEmail: data.contactEmail,
                  contactPhone: data.contactPhone,
                  address: data.address,
                  city: data.city,
                  supplierLogoUrl: data.supplierLogoUrl,
               }),
            );

            return {
               supplier: this.mapSupplierToProto(supplier),
            };
         })(),
      );
   }

   @GrpcMethod(SUPPLIER_V1_GRPC_SERVICE_NAME, SUPPLIER_V1_GRPC_METHODS.UPDATE_SUPPLIER_STATUS)
   updateSupplierStatus(
      data: IUpdateSupplierStatusRequest,
      metadata?: Metadata,
   ): Observable<IUpdateSupplierStatusResponse> {
      checkRoles(metadata, [DEFAULT_ROLES.ADMIN]);

      return from(
         this.commandBus
            .execute(new UpdateSupplierStatusCommand(data.supplierId, data.status as SupplierStatusType))
            .then((supplier) => ({
               supplier: this.mapSupplierToProto(supplier),
            })),
      );
   }

   @GrpcMethod(SUPPLIER_V1_GRPC_SERVICE_NAME, SUPPLIER_V1_GRPC_METHODS.VERIFY_SUPPLIER)
   verifySupplier(data: IVerifySupplierRequest, metadata?: Metadata): Observable<IVerifySupplierResponse> {
      checkRoles(metadata, [DEFAULT_ROLES.ADMIN]);

      return from(
         this.commandBus.execute(new VerifySupplierCommand(data.supplierId, data.isVerified)).then((supplier) => ({
            supplier: this.mapSupplierToProto(supplier),
         })),
      );
   }
}
