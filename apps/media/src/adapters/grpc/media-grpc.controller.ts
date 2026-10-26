import { Controller, UseFilters, UseInterceptors } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import type { Metadata } from '@grpc/grpc-js';
import { from, type Observable } from 'rxjs';
import {
   COMMON_ERROR_CODES,
   extractGrpcUser,
   GrpcExceptionFilter,
   GrpcLoggingInterceptor,
   GrpcMetricsInterceptor,
   UnauthorizedException,
} from '@common';
import {
   MEDIA_V1_GRPC_METHODS,
   MEDIA_V1_GRPC_SERVICE_NAME,
   type IConfirmUploadRequest,
   type IConfirmUploadResponse,
   type IDeleteMediaRequest,
   type IDeleteMediaResponse,
   type IGetMediaByIdRequest,
   type IGetMediaByIdResponse,
   type IGetUploadUrlRequest,
   type IGetUploadUrlResponse,
   type IMediaProto,
   type IMediaV1GrpcService,
   type IUploadFileRequest,
   type IUploadFileResponse,
   type IInitiateMultipartUploadRequest,
   type IInitiateMultipartUploadResponse,
   type ICompleteMultipartUploadRequest,
   type ICompleteMultipartUploadResponse,
   type MediaResponseDto,
} from '@contracts/media';
import { MediaService } from '@media/modules/media/media.service';

/**
 * Inbound Adapter (Hexagonal Architecture) handling incoming gRPC requests for MediaService.
 * Enforces metadata context and decentralized authorization (Ownership & Admin).
 */
@Controller()
@UseFilters(new GrpcExceptionFilter())
@UseInterceptors(GrpcLoggingInterceptor, GrpcMetricsInterceptor)
export class MediaGrpcController implements IMediaV1GrpcService {
   constructor(private readonly mediaService: MediaService) {}

   private mapMediaToProto(media: MediaResponseDto): IMediaProto {
      const metadata = media.metadata as Record<string, unknown> | null;
      return {
         id: media.id,
         userId: media.userId,
         provider: media.provider,
         type: media.type,
         status: media.status,
         url: media.url,
         key: media.key,
         mimeType: media.mimeType,
         size: Number(media.size) || 0,
         width: metadata?.width ? Number(metadata.width) : undefined,
         height: metadata?.height ? Number(metadata.height) : undefined,
         metadataJson: metadata ? JSON.stringify(metadata) : undefined,
         createdAt: media.createdAt instanceof Date ? media.createdAt.toISOString() : String(media.createdAt),
         updatedAt: media.updatedAt instanceof Date ? media.updatedAt.toISOString() : String(media.updatedAt),
      };
   }

   @GrpcMethod(MEDIA_V1_GRPC_SERVICE_NAME, MEDIA_V1_GRPC_METHODS.GET_UPLOAD_URL)
   getUploadUrl(data: IGetUploadUrlRequest, metadata?: Metadata): Observable<IGetUploadUrlResponse> {
      const user = extractGrpcUser(metadata);
      if (!user) {
         throw new UnauthorizedException(COMMON_ERROR_CODES.UNAUTHORIZED);
      }

      return from(
         this.mediaService
            .getUploadUrl(user.userId, {
               fileName: data.fileName,
               mimeType: data.mimeType,
               size: data.size,
               type: data.type as never,
               folder: data.folder,
               provider: data.provider as never,
            })
            .then((res): IGetUploadUrlResponse => ({
               mediaId: res.mediaId,
               provider: res.provider,
               method: res.method,
               uploadUrl: res.uploadUrl,
               publicUrl: res.publicUrl,
               key: res.key,
               signature: res.signature,
               timestamp: res.timestamp,
               apiKey: res.apiKey,
               cloudName: res.cloudName,
               headers: res.headers,
            })),
      );
   }

   @GrpcMethod(MEDIA_V1_GRPC_SERVICE_NAME, MEDIA_V1_GRPC_METHODS.UPLOAD_FILE)
   uploadFile(data: IUploadFileRequest, metadata?: Metadata): Observable<IUploadFileResponse> {
      const user = extractGrpcUser(metadata);
      if (!user) {
         throw new UnauthorizedException(COMMON_ERROR_CODES.UNAUTHORIZED);
      }

      return from(
         this.mediaService
            .uploadFile(user.userId, {
               fileBase64: data.fileBase64,
               fileName: data.fileName,
               mimeType: data.mimeType,
               type: data.type as never,
               folder: data.folder,
               provider: data.provider as never,
            })
            .then((media) => ({
               media: this.mapMediaToProto(media),
            })),
      );
   }

   @GrpcMethod(MEDIA_V1_GRPC_SERVICE_NAME, MEDIA_V1_GRPC_METHODS.CONFIRM_UPLOAD)
   confirmUpload(data: IConfirmUploadRequest, metadata?: Metadata): Observable<IConfirmUploadResponse> {
      const user = extractGrpcUser(metadata);
      if (!user) {
         throw new UnauthorizedException(COMMON_ERROR_CODES.UNAUTHORIZED);
      }

      return from(
         this.mediaService
            .confirmUpload(user.userId, {
               mediaId: data.mediaId,
               size: data.size,
               width: data.width,
               height: data.height,
               duration: data.duration,
               thumbnailUrl: data.thumbnailUrl,
            })
            .then((media) => ({
               media: this.mapMediaToProto(media),
            })),
      );
   }

   @GrpcMethod(MEDIA_V1_GRPC_SERVICE_NAME, MEDIA_V1_GRPC_METHODS.GET_MEDIA_BY_ID)
   getMediaById(data: IGetMediaByIdRequest): Observable<IGetMediaByIdResponse> {
      return from(
         this.mediaService.getMediaById(data.id).then((media) => ({
            media: this.mapMediaToProto(media),
         })),
      );
   }

   @GrpcMethod(MEDIA_V1_GRPC_SERVICE_NAME, MEDIA_V1_GRPC_METHODS.DELETE_MEDIA)
   deleteMedia(data: IDeleteMediaRequest, metadata?: Metadata): Observable<IDeleteMediaResponse> {
      return from(
         this.mediaService.deleteMedia(data.id, metadata as never).then((success) => ({
            success,
         })),
      );
   }

   @GrpcMethod(MEDIA_V1_GRPC_SERVICE_NAME, MEDIA_V1_GRPC_METHODS.INITIATE_MULTIPART_UPLOAD)
   initiateMultipartUpload(
      data: IInitiateMultipartUploadRequest,
      metadata?: Metadata,
   ): Observable<IInitiateMultipartUploadResponse> {
      const user = extractGrpcUser(metadata);
      if (!user) {
         throw new UnauthorizedException(COMMON_ERROR_CODES.UNAUTHORIZED);
      }

      return from(
         this.mediaService
            .initiateMultipartUpload(user.userId, {
               fileName: data.fileName,
               mimeType: data.mimeType,
               partsCount: data.partsCount,
               fileSize: data.fileSize,
               folder: data.folder,
            })
            .then((res) => ({
               mediaId: res.mediaId,
               uploadId: res.uploadId,
               key: res.key,
               publicUrl: res.publicUrl,
               parts: res.parts.map((p) => ({
                  partNumber: p.partNumber,
                  uploadUrl: p.uploadUrl,
               })),
            })),
      );
   }

   @GrpcMethod(MEDIA_V1_GRPC_SERVICE_NAME, MEDIA_V1_GRPC_METHODS.COMPLETE_MULTIPART_UPLOAD)
   completeMultipartUpload(
      data: ICompleteMultipartUploadRequest,
      metadata?: Metadata,
   ): Observable<ICompleteMultipartUploadResponse> {
      const user = extractGrpcUser(metadata);
      if (!user) {
         throw new UnauthorizedException(COMMON_ERROR_CODES.UNAUTHORIZED);
      }

      return from(
         this.mediaService
            .completeMultipartUpload(user.userId, {
               mediaId: data.mediaId,
               uploadId: data.uploadId,
               parts: data.parts.map((p) => ({
                  partNumber: p.partNumber,
                  etag: p.etag,
               })),
            })
            .then((media) => ({
               media: this.mapMediaToProto(media),
            })),
      );
   }
}
