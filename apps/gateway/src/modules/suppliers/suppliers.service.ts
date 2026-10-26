import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { defer, firstValueFrom } from 'rxjs';
import {
   CircuitBreakerRegistry,
   createGrpcMetadata,
   handleGrpcError,
   NotFoundException,
   RetryPolicyRegistry,
   SERVICE_NAMES,
   withGrpcRetry,
} from '@common';
import {
   SUPPLIER_ERROR_CODES,
   SUPPLIER_V1_GRPC_CLIENT,
   SUPPLIER_V1_GRPC_SERVICE_NAME,
   type IGetMySupplierRequest,
   type IGetSupplierByIdRequest,
   type IListSuppliersRequest,
   type IRegisterSupplierRequest,
   type ISupplierProto,
   type ISupplierV1GrpcService,
   type IUpdateSupplierRequest,
   type IUpdateSupplierStatusRequest,
   type IVerifySupplierRequest,
   type ListSuppliersQueryDto,
   type ListSuppliersResponseDto,
   type MySupplierResponseDto,
   type RegisterSupplierDto,
   type SupplierItemDto,
   type SupplierMemberStatusType,
   type SupplierRole,
   type SupplierStatusType,
   type UpdateSupplierDto,
} from '@contracts/supplier';

export interface SupplierCallOptions {
   authHeader?: string;
   correlationId?: string;
   accountId?: string;
   roles?: string[];
   permissions?: string[];
   email?: string;
}

@Injectable()
export class SuppliersService implements OnModuleInit {
   private supplierGrpcService!: ISupplierV1GrpcService;
   private readonly supplierGrpcBreaker = CircuitBreakerRegistry.getOrCreate(SUPPLIER_V1_GRPC_SERVICE_NAME, {
      timeout: 5000,
      failureThreshold: 5,
      resetTimeout: 10000,
   });
   private readonly supplierGrpcRetryPolicy = RetryPolicyRegistry.getOrCreate(SUPPLIER_V1_GRPC_SERVICE_NAME, {
      maxAttempts: 3,
      initialDelayMs: 100,
      multiplier: 2,
      maxDelayMs: 2000,
   });

   constructor(@Inject(SUPPLIER_V1_GRPC_CLIENT) private readonly supplierGrpcClient: ClientGrpc) {}

   onModuleInit(): void {
      this.supplierGrpcService =
         this.supplierGrpcClient.getService<ISupplierV1GrpcService>(SUPPLIER_V1_GRPC_SERVICE_NAME);
   }

   private mapProtoToDto(supp: ISupplierProto): SupplierItemDto {
      return {
         supplierId: supp.supplierId,
         supplierName: supp.supplierName,
         supplierSlug: supp.supplierSlug,
         supplierCode: supp.supplierCode,
         contactEmail: supp.contactEmail || undefined,
         contactPhone: supp.contactPhone || undefined,
         address: supp.address || undefined,
         city: supp.city || undefined,
         rating: supp.rating,
         isVerified: supp.isVerified,
         supplierStatus: supp.supplierStatus as SupplierStatusType,
         supplierLogoUrl: supp.supplierLogoUrl || undefined,
      };
   }

   /**
    * Registers a new supplier in the Supplier Microservice via gRPC.
    * Forwards verified caller context (userId, accountId, roles) through gRPC metadata.
    */
   async registerSupplier(dto: RegisterSupplierDto, options?: SupplierCallOptions): Promise<SupplierItemDto> {
      try {
         const accountId = options?.accountId;
         const metadata = createGrpcMetadata({
            correlationId: options?.correlationId,
            callerService: SERVICE_NAMES.GATEWAY,
            userId: accountId,
            accountId,
            roles: options?.roles,
            permissions: options?.permissions,
            email: options?.email,
         });

         return await this.supplierGrpcBreaker.execute(async () => {
            const request: IRegisterSupplierRequest = {
               supplierName: dto.supplierName,
               supplierCode: dto.supplierCode,
               contactEmail: dto.contactEmail,
               contactPhone: dto.contactPhone,
               address: dto.address,
               city: dto.city,
               supplierLogoUrl: dto.supplierLogoUrl,
            };

            const res = await firstValueFrom(
               defer(() => this.supplierGrpcService.registerSupplier(request, metadata)).pipe(
                  withGrpcRetry(this.supplierGrpcRetryPolicy),
               ),
            );

            return this.mapProtoToDto(res.supplier);
         });
      } catch (error: unknown) {
         return handleGrpcError(error);
      }
   }

   /**
    * Retrieves the current authenticated supplier profile and onboarding state.
    */
   async getMySupplier(options?: SupplierCallOptions): Promise<MySupplierResponseDto> {
      try {
         const accountId = options?.accountId;
         const metadata = createGrpcMetadata({
            correlationId: options?.correlationId,
            callerService: SERVICE_NAMES.GATEWAY,
            userId: accountId,
            accountId,
            roles: options?.roles,
            permissions: options?.permissions,
            email: options?.email,
         });

         return await this.supplierGrpcBreaker.execute(async () => {
            const request: IGetMySupplierRequest = {
               accountId: accountId || '',
            };

            const res = await firstValueFrom(
               defer(() => this.supplierGrpcService.getMySupplier(request, metadata)).pipe(
                  withGrpcRetry(this.supplierGrpcRetryPolicy),
               ),
            );

            return {
               hasSupplier: res.hasSupplier,
               supplier: res.supplier ? this.mapProtoToDto(res.supplier) : null,
               role: (res.role as SupplierRole) || undefined,
               memberStatus: (res.memberStatus as SupplierMemberStatusType) || undefined,
            };
         });
      } catch (error: unknown) {
         return handleGrpcError(error);
      }
   }

   /**
    * Retrieves single supplier details by unique ID via gRPC.
    */
   async getSupplierById(supplierId: string, options?: SupplierCallOptions): Promise<SupplierItemDto> {
      try {
         const metadata = createGrpcMetadata({
            correlationId: options?.correlationId,
            callerService: SERVICE_NAMES.GATEWAY,
            userId: options?.accountId,
            accountId: options?.accountId,
            roles: options?.roles,
            permissions: options?.permissions,
            email: options?.email,
         });

         return await this.supplierGrpcBreaker.execute(async () => {
            const request: IGetSupplierByIdRequest = { supplierId };
            const res = await firstValueFrom(
               defer(() => this.supplierGrpcService.getSupplierById(request, metadata)).pipe(
                  withGrpcRetry(this.supplierGrpcRetryPolicy),
               ),
            );

            if (!res.supplier) {
               throw new NotFoundException(SUPPLIER_ERROR_CODES.SUPPLIER_NOT_FOUND, {
                  params: { supplierId },
               });
            }

            return this.mapProtoToDto(res.supplier);
         });
      } catch (error: unknown) {
         return handleGrpcError(error);
      }
   }

   /**
    * Retrieves a paginated list of suppliers matching criteria via gRPC.
    */
   async listSuppliers(query: ListSuppliersQueryDto, options?: SupplierCallOptions): Promise<ListSuppliersResponseDto> {
      try {
         const metadata = createGrpcMetadata({
            correlationId: options?.correlationId,
            callerService: SERVICE_NAMES.GATEWAY,
            userId: options?.accountId,
            accountId: options?.accountId,
            roles: options?.roles,
            permissions: options?.permissions,
            email: options?.email,
         });

         return await this.supplierGrpcBreaker.execute(async () => {
            const request: IListSuppliersRequest = {
               status: query.status,
               city: query.city,
               limit: query.limit,
               offset: query.offset,
            };

            const res = await firstValueFrom(
               defer(() => this.supplierGrpcService.listSuppliers(request, metadata)).pipe(
                  withGrpcRetry(this.supplierGrpcRetryPolicy),
               ),
            );

            return {
               items: (res.suppliers || []).map((s) => this.mapProtoToDto(s)),
               total: res.total,
               limit: query.limit ?? 20,
               offset: query.offset ?? 0,
            };
         });
      } catch (error: unknown) {
         return handleGrpcError(error);
      }
   }

   /**
    * Updates supplier store details via gRPC.
    */
   async updateSupplier(
      supplierId: string,
      dto: UpdateSupplierDto,
      options?: SupplierCallOptions,
   ): Promise<SupplierItemDto> {
      try {
         const metadata = createGrpcMetadata({
            correlationId: options?.correlationId,
            callerService: SERVICE_NAMES.GATEWAY,
            userId: options?.accountId,
            accountId: options?.accountId,
            roles: options?.roles,
            permissions: options?.permissions,
            email: options?.email,
         });

         return await this.supplierGrpcBreaker.execute(async () => {
            const request: IUpdateSupplierRequest = {
               supplierId,
               supplierName: dto.supplierName,
               contactEmail: dto.contactEmail,
               contactPhone: dto.contactPhone,
               address: dto.address,
               city: dto.city,
               supplierLogoUrl: dto.supplierLogoUrl,
            };

            const res = await firstValueFrom(
               defer(() => this.supplierGrpcService.updateSupplier(request, metadata)).pipe(
                  withGrpcRetry(this.supplierGrpcRetryPolicy),
               ),
            );

            return this.mapProtoToDto(res.supplier);
         });
      } catch (error: unknown) {
         return handleGrpcError(error);
      }
   }

   /**
    * Updates supplier store operational status via gRPC (Admin operation).
    */
   async updateSupplierStatus(
      supplierId: string,
      status: SupplierStatusType,
      options?: SupplierCallOptions,
   ): Promise<SupplierItemDto> {
      try {
         const metadata = createGrpcMetadata({
            correlationId: options?.correlationId,
            callerService: SERVICE_NAMES.GATEWAY,
            userId: options?.accountId,
            accountId: options?.accountId,
            roles: options?.roles,
            permissions: options?.permissions,
            email: options?.email,
         });

         return await this.supplierGrpcBreaker.execute(async () => {
            const request: IUpdateSupplierStatusRequest = {
               supplierId,
               status,
            };

            const res = await firstValueFrom(
               defer(() => this.supplierGrpcService.updateSupplierStatus(request, metadata)).pipe(
                  withGrpcRetry(this.supplierGrpcRetryPolicy),
               ),
            );

            return this.mapProtoToDto(res.supplier);
         });
      } catch (error: unknown) {
         return handleGrpcError(error);
      }
   }

   /**
    * Sets or revokes verification for a supplier via gRPC (Admin operation).
    */
   async verifySupplier(
      supplierId: string,
      isVerified: boolean,
      options?: SupplierCallOptions,
   ): Promise<SupplierItemDto> {
      try {
         const metadata = createGrpcMetadata({
            correlationId: options?.correlationId,
            callerService: SERVICE_NAMES.GATEWAY,
            userId: options?.accountId,
            accountId: options?.accountId,
            roles: options?.roles,
            permissions: options?.permissions,
            email: options?.email,
         });

         return await this.supplierGrpcBreaker.execute(async () => {
            const request: IVerifySupplierRequest = {
               supplierId,
               isVerified,
            };

            const res = await firstValueFrom(
               defer(() => this.supplierGrpcService.verifySupplier(request, metadata)).pipe(
                  withGrpcRetry(this.supplierGrpcRetryPolicy),
               ),
            );

            return this.mapProtoToDto(res.supplier);
         });
      } catch (error: unknown) {
         return handleGrpcError(error);
      }
   }
}
