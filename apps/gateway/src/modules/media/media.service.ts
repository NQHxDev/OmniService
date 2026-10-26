import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { defer, firstValueFrom } from 'rxjs';
import {
   CircuitBreakerRegistry,
   createGrpcMetadata,
   handleGrpcError,
   RetryPolicyRegistry,
   SERVICE_NAMES,
   withGrpcRetry,
   type JwtPayload,
} from '@common';
import {
   MEDIA_V1_GRPC_CLIENT,
   MEDIA_V1_GRPC_SERVICE_NAME,
   type ConfirmUploadDto,
   type DeleteMediaResponseDto,
   type GetUploadUrlDto,
   type IMediaProto,
   type IMediaV1GrpcService,
   type MediaResponseDto,
   type UploadFileDto,
   type UploadUrlResponseDto,
   type InitiateMultipartUploadDto,
   type InitiateMultipartUploadResponseDto,
   type CompleteMultipartUploadDto,
} from '@contracts/media';

@Injectable()
export class MediaService implements OnModuleInit {
   private mediaGrpcService!: IMediaV1GrpcService;
   private readonly mediaGrpcBreaker = CircuitBreakerRegistry.getOrCreate(MEDIA_V1_GRPC_SERVICE_NAME, {
      timeout: 5000,
      failureThreshold: 5,
      resetTimeout: 10000,
   });
   private readonly mediaGrpcRetryPolicy = RetryPolicyRegistry.getOrCreate(MEDIA_V1_GRPC_SERVICE_NAME, {
      maxAttempts: 3,
      initialDelayMs: 100,
      multiplier: 2,
      maxDelayMs: 2000,
   });

   constructor(
      @Inject(MEDIA_V1_GRPC_CLIENT)
      private readonly mediaGrpcClient: ClientGrpc,
   ) {}

   onModuleInit(): void {
      this.mediaGrpcService = this.mediaGrpcClient.getService<IMediaV1GrpcService>(MEDIA_V1_GRPC_SERVICE_NAME);
   }

   private buildGrpcMetadata(user?: JwtPayload, correlationId?: string) {
      return createGrpcMetadata({
         correlationId,
         callerService: SERVICE_NAMES.GATEWAY,
         user: user
            ? {
                 userId: user.sub,
                 accountId: user.sub,
                 roles: user.roles || [],
                 email: user.email,
                 permissions: (user.permissions as string[]) || [],
                 sessionId: user.jti,
              }
            : undefined,
      });
   }

   private mapProtoToMediaResponse(proto: IMediaProto): MediaResponseDto {
      let parsedMetadata: Record<string, unknown> | null = null;
      if (proto.metadataJson) {
         try {
            parsedMetadata = JSON.parse(proto.metadataJson) as Record<string, unknown>;
         } catch {
            parsedMetadata = null;
         }
      }
      return {
         id: proto.id,
         userId: proto.userId,
         provider: proto.provider as never,
         type: proto.type as never,
         url: proto.url,
         key: proto.key,
         mimeType: proto.mimeType,
         size: Number(proto.size) || 0,
         status: proto.status as never,
         metadata: parsedMetadata,
         createdAt: new Date(proto.createdAt),
         updatedAt: new Date(proto.updatedAt),
      };
   }

   async getUploadUrl(dto: GetUploadUrlDto, user: JwtPayload, correlationId?: string): Promise<UploadUrlResponseDto> {
      try {
         const metadata = this.buildGrpcMetadata(user, correlationId);
         return await this.mediaGrpcBreaker.execute(async () => {
            const res = await firstValueFrom(
               defer(() =>
                  this.mediaGrpcService.getUploadUrl(
                     {
                        fileName: dto.fileName,
                        mimeType: dto.mimeType,
                        size: dto.size,
                        type: dto.type,
                        folder: dto.folder,
                        provider: dto.provider,
                     },
                     metadata,
                  ),
               ).pipe(withGrpcRetry(this.mediaGrpcRetryPolicy)),
            );
            return {
               mediaId: res.mediaId,
               provider: res.provider as never,
               method: res.method as never,
               uploadUrl: res.uploadUrl,
               publicUrl: res.publicUrl,
               key: res.key,
               signature: res.signature,
               timestamp: res.timestamp ? Number(res.timestamp) : undefined,
               apiKey: res.apiKey,
               cloudName: res.cloudName,
               headers: res.headers,
            };
         });
      } catch (error: unknown) {
         return handleGrpcError(error);
      }
   }

   async uploadFile(dto: UploadFileDto, user: JwtPayload, correlationId?: string): Promise<MediaResponseDto> {
      try {
         const metadata = this.buildGrpcMetadata(user, correlationId);
         return await this.mediaGrpcBreaker.execute(async () => {
            const res = await firstValueFrom(
               defer(() =>
                  this.mediaGrpcService.uploadFile(
                     {
                        fileBase64: dto.fileBase64,
                        fileName: dto.fileName,
                        mimeType: dto.mimeType,
                        type: dto.type,
                        folder: dto.folder,
                        provider: dto.provider,
                     },
                     metadata,
                  ),
               ).pipe(withGrpcRetry(this.mediaGrpcRetryPolicy)),
            );
            return this.mapProtoToMediaResponse(res.media);
         });
      } catch (error: unknown) {
         return handleGrpcError(error);
      }
   }

   async confirmUpload(dto: ConfirmUploadDto, user: JwtPayload, correlationId?: string): Promise<MediaResponseDto> {
      try {
         const metadata = this.buildGrpcMetadata(user, correlationId);
         return await this.mediaGrpcBreaker.execute(async () => {
            const res = await firstValueFrom(
               defer(() =>
                  this.mediaGrpcService.confirmUpload(
                     {
                        mediaId: dto.mediaId,
                        size: dto.size,
                        width: dto.width,
                        height: dto.height,
                        duration: dto.duration,
                        thumbnailUrl: dto.thumbnailUrl,
                     },
                     metadata,
                  ),
               ).pipe(withGrpcRetry(this.mediaGrpcRetryPolicy)),
            );
            return this.mapProtoToMediaResponse(res.media);
         });
      } catch (error: unknown) {
         return handleGrpcError(error);
      }
   }

   async getMediaById(id: string, correlationId?: string): Promise<MediaResponseDto> {
      try {
         const metadata = this.buildGrpcMetadata(undefined, correlationId);
         return await this.mediaGrpcBreaker.execute(async () => {
            const res = await firstValueFrom(
               defer(() => this.mediaGrpcService.getMediaById({ id }, metadata)).pipe(
                  withGrpcRetry(this.mediaGrpcRetryPolicy),
               ),
            );
            return this.mapProtoToMediaResponse(res.media);
         });
      } catch (error: unknown) {
         return handleGrpcError(error);
      }
   }

   async deleteMedia(id: string, user: JwtPayload, correlationId?: string): Promise<DeleteMediaResponseDto> {
      try {
         const metadata = this.buildGrpcMetadata(user, correlationId);
         return await this.mediaGrpcBreaker.execute(async () => {
            const res = await firstValueFrom(
               defer(() => this.mediaGrpcService.deleteMedia({ id }, metadata)).pipe(
                  withGrpcRetry(this.mediaGrpcRetryPolicy),
               ),
            );
            return { success: res.success };
         });
      } catch (error: unknown) {
         return handleGrpcError(error);
      }
   }

   async initiateMultipartUpload(
      dto: InitiateMultipartUploadDto,
      user: JwtPayload,
      correlationId?: string,
   ): Promise<InitiateMultipartUploadResponseDto> {
      try {
         const metadata = this.buildGrpcMetadata(user, correlationId);
         return await this.mediaGrpcBreaker.execute(async () => {
            const res = await firstValueFrom(
               defer(() =>
                  this.mediaGrpcService.initiateMultipartUpload(
                     {
                        fileName: dto.fileName,
                        mimeType: dto.mimeType,
                        partsCount: dto.partsCount,
                        fileSize: dto.fileSize,
                        folder: dto.folder,
                     },
                     metadata,
                  ),
               ).pipe(withGrpcRetry(this.mediaGrpcRetryPolicy)),
            );
            return {
               mediaId: res.mediaId,
               uploadId: res.uploadId,
               key: res.key,
               publicUrl: res.publicUrl,
               parts: res.parts.map((p) => ({
                  partNumber: p.partNumber,
                  uploadUrl: p.uploadUrl,
               })),
            };
         });
      } catch (error: unknown) {
         return handleGrpcError(error);
      }
   }

   async completeMultipartUpload(
      dto: CompleteMultipartUploadDto,
      user: JwtPayload,
      correlationId?: string,
   ): Promise<MediaResponseDto> {
      try {
         const metadata = this.buildGrpcMetadata(user, correlationId);
         return await this.mediaGrpcBreaker.execute(async () => {
            const res = await firstValueFrom(
               defer(() =>
                  this.mediaGrpcService.completeMultipartUpload(
                     {
                        mediaId: dto.mediaId,
                        uploadId: dto.uploadId,
                        parts: dto.parts.map((p) => ({
                           partNumber: p.partNumber,
                           etag: p.etag,
                        })),
                     },
                     metadata,
                  ),
               ).pipe(withGrpcRetry(this.mediaGrpcRetryPolicy)),
            );
            return this.mapProtoToMediaResponse(res.media);
         });
      } catch (error: unknown) {
         return handleGrpcError(error);
      }
   }
}
