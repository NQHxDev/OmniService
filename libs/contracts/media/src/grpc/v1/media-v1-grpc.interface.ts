import type { Observable } from 'rxjs';
import type { Metadata } from '@grpc/grpc-js';

export interface IMediaProto {
   id: string;
   userId: string;
   provider: string;
   type: string;
   status: string;
   url: string;
   key: string;
   mimeType: string;
   size: number;
   width?: number;
   height?: number;
   metadataJson?: string;
   createdAt: string;
   updatedAt: string;
}

export interface IGetUploadUrlRequest {
   fileName: string;
   mimeType: string;
   size?: number;
   type?: string;
   folder?: string;
   provider?: string;
}

export interface IGetUploadUrlResponse {
   mediaId: string;
   provider: string;
   method: string;
   uploadUrl?: string;
   publicUrl?: string;
   key?: string;
   signature?: string;
   timestamp?: number;
   apiKey?: string;
   cloudName?: string;
   headers?: Record<string, string>;
}

export interface IUploadFileRequest {
   fileBase64: string;
   fileName?: string;
   mimeType?: string;
   type?: string;
   folder?: string;
   provider?: string;
}

export interface IUploadFileResponse {
   media: IMediaProto;
}

export interface IConfirmUploadRequest {
   mediaId: string;
   size?: number;
   width?: number;
   height?: number;
   duration?: number;
   thumbnailUrl?: string;
}

export interface IConfirmUploadResponse {
   media: IMediaProto;
}

export interface IGetMediaByIdRequest {
   id: string;
}

export interface IGetMediaByIdResponse {
   media: IMediaProto;
}

export interface IDeleteMediaRequest {
   id: string;
}

export interface IDeleteMediaResponse {
   success: boolean;
}

export interface IMultipartPartUrlProto {
   partNumber: number;
   uploadUrl: string;
}

export interface ICompletedPartProto {
   partNumber: number;
   etag: string;
}

export interface IInitiateMultipartUploadRequest {
   fileName: string;
   mimeType: string;
   partsCount: number;
   fileSize?: number;
   folder?: string;
}

export interface IInitiateMultipartUploadResponse {
   mediaId: string;
   uploadId: string;
   key: string;
   publicUrl: string;
   parts: IMultipartPartUrlProto[];
}

export interface ICompleteMultipartUploadRequest {
   mediaId: string;
   uploadId: string;
   parts: ICompletedPartProto[];
}

export interface ICompleteMultipartUploadResponse {
   media: IMediaProto;
}

export interface IMediaV1GrpcService {
   getUploadUrl(request: IGetUploadUrlRequest, metadata?: Metadata): Observable<IGetUploadUrlResponse>;
   uploadFile(request: IUploadFileRequest, metadata?: Metadata): Observable<IUploadFileResponse>;
   confirmUpload(request: IConfirmUploadRequest, metadata?: Metadata): Observable<IConfirmUploadResponse>;
   getMediaById(request: IGetMediaByIdRequest, metadata?: Metadata): Observable<IGetMediaByIdResponse>;
   deleteMedia(request: IDeleteMediaRequest, metadata?: Metadata): Observable<IDeleteMediaResponse>;
   initiateMultipartUpload(
      request: IInitiateMultipartUploadRequest,
      metadata?: Metadata,
   ): Observable<IInitiateMultipartUploadResponse>;
   completeMultipartUpload(
      request: ICompleteMultipartUploadRequest,
      metadata?: Metadata,
   ): Observable<ICompleteMultipartUploadResponse>;
}

export type IMediaGrpcService = IMediaV1GrpcService;
