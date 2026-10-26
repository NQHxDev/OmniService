import { Inject, Injectable, Logger } from '@nestjs/common';
import {
   MEDIA_PROVIDERS,
   MEDIA_TYPES,
   type MediaType,
   MEDIA_STATUSES,
   MEDIA_ERROR_CODES,
   type GetUploadUrlDto,
   type UploadFileDto,
   type ConfirmUploadDto,
   type MediaResponseDto,
   type UploadUrlResponseDto,
   type InitiateMultipartUploadDto,
   type InitiateMultipartUploadResponseDto,
   type CompleteMultipartUploadDto,
} from '@contracts/media';
import { NotFoundException, ForbiddenException, checkOwnershipOrAdmin, type IServiceMessage } from '@common';
import type { Media } from '@media/prisma-client';
import { StorageStrategyFactory } from '@media/storage';
import { CloudflareR2Provider } from '@media/storage/providers/r2.provider';
import { MEDIA_REPOSITORY, type IMediaRepository } from '@media/modules/media/repositories/media.repository.interface';
import { MEDIA_EVENT_PUBLISHER, type IMediaEventPublisher } from '@media/modules/transcoding';
import { generateUniqueFileName } from '@media/utils';

@Injectable()
export class MediaService {
   private readonly logger = new Logger(MediaService.name);

   constructor(
      @Inject(MEDIA_REPOSITORY)
      private readonly mediaRepository: IMediaRepository,
      private readonly storageStrategyFactory: StorageStrategyFactory,
      private readonly r2Provider: CloudflareR2Provider,
      @Inject(MEDIA_EVENT_PUBLISHER)
      private readonly mediaEventPublisher: IMediaEventPublisher,
   ) {}

   async getUploadUrl(userId: string, dto: GetUploadUrlDto): Promise<UploadUrlResponseDto> {
      const type = dto.type || this.inferMediaType(dto.mimeType);
      const providerInstance = this.storageStrategyFactory.getProvider(dto.provider, type);

      const uniqueFileName = generateUniqueFileName(dto.fileName);
      const folder = dto.folder || `omni/${type.toLowerCase()}s`;
      const fullKey = `${folder}/${uniqueFileName}`;

      const uploadResult = await providerInstance.generateUploadUrl({
         key: uniqueFileName,
         folder,
         mimeType: dto.mimeType,
         type,
         size: dto.size,
         userId,
      });

      // Reserve record in PENDING state
      const media = await this.mediaRepository.create({
         userId,
         provider: providerInstance.provider,
         type,
         url: uploadResult.publicUrl,
         key: fullKey,
         mimeType: dto.mimeType,
         size: dto.size || 0,
         status: MEDIA_STATUSES.PENDING,
      });

      this.logger.log(`Created pending media record ${media.id} for user ${userId} via ${providerInstance.provider}`);

      return {
         mediaId: media.id,
         provider: providerInstance.provider,
         method: uploadResult.method,
         uploadUrl: uploadResult.uploadUrl,
         publicUrl: uploadResult.publicUrl,
         key: fullKey,
         signature: uploadResult.signature,
         timestamp: uploadResult.timestamp,
         apiKey: uploadResult.apiKey,
         cloudName: uploadResult.cloudName,
         headers: uploadResult.headers,
      };
   }

   async uploadFile(userId: string, dto: UploadFileDto): Promise<MediaResponseDto> {
      const mimeType = dto.mimeType || 'image/jpeg';
      const type = dto.type || this.inferMediaType(mimeType);
      const providerInstance = this.storageStrategyFactory.getProvider(dto.provider, type);

      const folder = dto.folder || `omni/${type.toLowerCase()}s`;
      const uniqueFileName = generateUniqueFileName(dto.fileName);
      const fullKey = `${folder}/${uniqueFileName}`;

      const uploadResult = await providerInstance.uploadBase64(dto.fileBase64, {
         key: uniqueFileName,
         folder,
         mimeType,
      });

      const media = await this.mediaRepository.create({
         userId,
         provider: providerInstance.provider,
         type,
         url: uploadResult.url,
         key: uploadResult.key || fullKey,
         mimeType,
         size: uploadResult.bytes || 0,
         status: MEDIA_STATUSES.READY,
         metadata: {
            width: uploadResult.width,
            height: uploadResult.height,
            format: uploadResult.format,
         },
      });

      this.logger.log(`Directly uploaded media ${media.id} for user ${userId} to ${providerInstance.provider}`);
      return this.mapToResponse(media);
   }

   async confirmUpload(userId: string, dto: ConfirmUploadDto): Promise<MediaResponseDto> {
      const media = await this.mediaRepository.findById(dto.mediaId);
      if (!media) {
         throw new NotFoundException(MEDIA_ERROR_CODES.MEDIA_NOT_FOUND, {
            params: { mediaId: dto.mediaId },
         });
      }

      if (media.userId !== userId) {
         throw new ForbiddenException(MEDIA_ERROR_CODES.CONFIRMATION_FAILED);
      }

      const existingMetadata = (media.metadata as Record<string, unknown>) || {};
      const updated = await this.mediaRepository.update(dto.mediaId, {
         status: MEDIA_STATUSES.READY,
         size: dto.size ?? media.size,
         metadata: {
            ...existingMetadata,
            ...(dto.width !== undefined && { width: dto.width }),
            ...(dto.height !== undefined && { height: dto.height }),
            ...(dto.duration !== undefined && { duration: dto.duration }),
            ...(dto.thumbnailUrl !== undefined && { thumbnailUrl: dto.thumbnailUrl }),
         },
      });

      this.logger.log(`Confirmed media upload ${updated.id} status to READY`);
      return this.mapToResponse(updated);
   }

   async initiateMultipartUpload(
      userId: string,
      dto: InitiateMultipartUploadDto,
   ): Promise<InitiateMultipartUploadResponseDto> {
      const type = this.inferMediaType(dto.mimeType);
      const uniqueFileName = generateUniqueFileName(dto.fileName);
      const folder = dto.folder || 'omni/videos/raw';
      const fullKey = `${folder}/${uniqueFileName}`;

      const uploadId = await this.r2Provider.initiateMultipartUpload(fullKey, dto.mimeType);
      const parts = await this.r2Provider.generatePartUploadUrls(fullKey, uploadId, dto.partsCount);
      const publicUrl = this.r2Provider.getPublicUrl(fullKey);

      const media = await this.mediaRepository.create({
         userId,
         provider: MEDIA_PROVIDERS.CLOUDFLARE_R2,
         type,
         url: publicUrl,
         key: fullKey,
         mimeType: dto.mimeType,
         size: dto.fileSize || 0,
         status: MEDIA_STATUSES.PENDING,
         metadata: {
            uploadId,
            partsCount: dto.partsCount,
         },
      });

      this.logger.log(`Initiated multipart upload for media ${media.id}, user ${userId}, uploadId ${uploadId}`);

      return {
         mediaId: media.id,
         uploadId,
         key: fullKey,
         publicUrl,
         parts,
      };
   }

   async completeMultipartUpload(userId: string, dto: CompleteMultipartUploadDto): Promise<MediaResponseDto> {
      const media = await this.mediaRepository.findById(dto.mediaId);
      if (!media) {
         throw new NotFoundException(MEDIA_ERROR_CODES.MEDIA_NOT_FOUND, {
            params: { mediaId: dto.mediaId },
         });
      }

      if (media.userId !== userId) {
         throw new ForbiddenException(MEDIA_ERROR_CODES.CONFIRMATION_FAILED);
      }

      // Finalize multipart assembly on Cloudflare R2
      const publicRawUrl = await this.r2Provider.completeMultipartUpload(media.key, dto.uploadId, dto.parts);

      // Transition entity to PROCESSING state while FFmpeg transcodes
      const existingMetadata = (media.metadata as Record<string, unknown>) || {};
      const updated = await this.mediaRepository.update(dto.mediaId, {
         status: MEDIA_STATUSES.PROCESSING,
         url: publicRawUrl,
         metadata: {
            ...existingMetadata,
            rawUrl: publicRawUrl,
            completedAt: new Date().toISOString(),
         },
      });

      this.logger.log(`Multipart upload finalized for media ${updated.id}. Publishing transcode requested event.`);

      // Dispatch async transcoding job via RabbitMQ
      await this.mediaEventPublisher.publishTranscodeRequested({
         mediaId: updated.id,
         key: updated.key,
         mimeType: updated.mimeType,
         userId,
      });

      return this.mapToResponse(updated);
   }

   async getMediaById(id: string): Promise<MediaResponseDto> {
      const media = await this.mediaRepository.findById(id);
      if (!media) {
         throw new NotFoundException(MEDIA_ERROR_CODES.MEDIA_NOT_FOUND, {
            params: { id },
         });
      }
      return this.mapToResponse(media);
   }

   async deleteMedia(id: string, message: IServiceMessage<unknown>): Promise<boolean> {
      const media = await this.mediaRepository.findById(id);
      if (!media) {
         throw new NotFoundException(MEDIA_ERROR_CODES.MEDIA_NOT_FOUND, {
            params: { id },
         });
      }

      checkOwnershipOrAdmin(message, media.userId);

      const providerInstance = this.storageStrategyFactory.getProvider(media.provider);
      await providerInstance.deleteFile(media.key);
      await this.mediaRepository.delete(id);

      this.logger.log(`Deleted media ${id} from storage ${media.provider} and database`);
      return true;
   }

   private inferMediaType(mimeType: string): MediaType {
      if (mimeType.startsWith('image/')) {
         return MEDIA_TYPES.IMAGE;
      }
      if (mimeType.startsWith('video/')) {
         return MEDIA_TYPES.VIDEO;
      }
      if (mimeType.startsWith('audio/')) {
         return MEDIA_TYPES.AUDIO;
      }
      return MEDIA_TYPES.DOCUMENT;
   }

   private mapToResponse(media: Media): MediaResponseDto {
      return {
         id: media.id,
         userId: media.userId,
         provider: media.provider,
         type: media.type,
         url: media.url,
         key: media.key,
         mimeType: media.mimeType,
         size: media.size,
         status: media.status,
         metadata: (media.metadata as Record<string, unknown>) ?? null,
         createdAt: media.createdAt,
         updatedAt: media.updatedAt,
      };
   }
}
