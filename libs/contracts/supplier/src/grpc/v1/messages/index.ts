import type { ISupplierProto } from '@contracts/supplier/grpc/v1/models';

export interface IGetSupplierByIdRequest {
   supplierId: string;
}

export interface IGetSupplierByIdResponse {
   supplier?: ISupplierProto;
}

export interface IGetSuppliersByIdsRequest {
   supplierIds: string[];
}

export interface IGetSuppliersByIdsResponse {
   suppliers: ISupplierProto[];
}

export interface IListSuppliersRequest {
   status?: string;
   city?: string;
   limit?: number;
   offset?: number;
}

export interface IListSuppliersResponse {
   suppliers: ISupplierProto[];
   total: number;
}

export interface IRegisterSupplierRequest {
   supplierName: string;
   supplierCode?: string;
   contactEmail?: string;
   contactPhone?: string;
   address?: string;
   city?: string;
   supplierLogoUrl?: string;
}

export interface IRegisterSupplierResponse {
   supplier: ISupplierProto;
}

export interface IGetMySupplierRequest {
   accountId?: string;
}

export interface IGetMySupplierResponse {
   hasSupplier: boolean;
   supplier?: ISupplierProto;
   role?: string;
   memberStatus?: string;
}

export interface IUpdateSupplierRequest {
   supplierId: string;
   supplierName?: string;
   contactEmail?: string;
   contactPhone?: string;
   address?: string;
   city?: string;
   supplierLogoUrl?: string;
}

export interface IUpdateSupplierResponse {
   supplier: ISupplierProto;
}

export interface IVerifySupplierRequest {
   supplierId: string;
   isVerified: boolean;
}

export interface IVerifySupplierResponse {
   supplier: ISupplierProto;
}

export interface IUpdateSupplierStatusRequest {
   supplierId: string;
   status: string;
}

export interface IUpdateSupplierStatusResponse {
   supplier: ISupplierProto;
}
