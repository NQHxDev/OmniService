import type { Observable } from 'rxjs';
import type { Metadata } from '@grpc/grpc-js';
import type {
   IGetMySupplierRequest,
   IGetMySupplierResponse,
   IGetSupplierByIdRequest,
   IGetSupplierByIdResponse,
   IGetSuppliersByIdsRequest,
   IGetSuppliersByIdsResponse,
   IListSuppliersRequest,
   IListSuppliersResponse,
   IRegisterSupplierRequest,
   IRegisterSupplierResponse,
   IUpdateSupplierRequest,
   IUpdateSupplierResponse,
   IVerifySupplierRequest,
   IVerifySupplierResponse,
   IUpdateSupplierStatusRequest,
   IUpdateSupplierStatusResponse,
} from '@contracts/supplier/grpc/v1/messages';

export interface ISupplierV1GrpcService {
   getSupplierById(request: IGetSupplierByIdRequest, metadata?: Metadata): Observable<IGetSupplierByIdResponse>;

   getSuppliersByIds(request: IGetSuppliersByIdsRequest, metadata?: Metadata): Observable<IGetSuppliersByIdsResponse>;

   listSuppliers(request: IListSuppliersRequest, metadata?: Metadata): Observable<IListSuppliersResponse>;

   registerSupplier(request: IRegisterSupplierRequest, metadata?: Metadata): Observable<IRegisterSupplierResponse>;

   getMySupplier(request: IGetMySupplierRequest, metadata?: Metadata): Observable<IGetMySupplierResponse>;

   updateSupplier(request: IUpdateSupplierRequest, metadata?: Metadata): Observable<IUpdateSupplierResponse>;

   verifySupplier(request: IVerifySupplierRequest, metadata?: Metadata): Observable<IVerifySupplierResponse>;

   updateSupplierStatus(
      request: IUpdateSupplierStatusRequest,
      metadata?: Metadata,
   ): Observable<IUpdateSupplierStatusResponse>;
}

export type ISupplierGrpcService = ISupplierV1GrpcService;
