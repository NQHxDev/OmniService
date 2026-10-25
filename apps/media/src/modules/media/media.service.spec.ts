import { MEDIA_PROVIDERS, MEDIA_STATUSES, MEDIA_TYPES } from '@contracts/media';
import { MediaService } from '@media/modules/media/media.service';
import type { IMediaRepository } from '@media/modules/media/repositories/media.repository.interface';
import type { StorageStrategyFactory } from '@media/storage';
import type { CloudflareR2Provider } from '@media/storage/providers/r2.provider';
import type { IMediaEventPublisher } from '@media/modules/transcoding';

describe('MediaService', () => {
   let service: MediaService;
   let mockRepository: jest.Mocked<IMediaRepository>;
   let mockStorageFactory: jest.Mocked<StorageStrategyFactory>;
   let mockR2Provider: jest.Mocked<CloudflareR2Provider>;
   let mockEventPublisher: jest.Mocked<IMediaEventPublisher>;

   beforeEach(() => {
      mockRepository = {
         findById: jest.fn(),
         create: jest.fn(),
         update: jest.fn(),
         delete: jest.fn(),
         findByUserId: jest.fn(),
      };

      mockStorageFactory = {
         getProvider: jest.fn(),
      } as unknown as jest.Mocked<StorageStrategyFactory>;

      mockR2Provider = {
         initiateMultipartUpload: jest.fn(),
         generatePartUploadUrls: jest.fn(),
         completeMultipartUpload: jest.fn(),
         abortMultipartUpload: jest.fn(),
         downloadFile: jest.fn(),
         uploadFileFromDisk: jest.fn(),
         uploadDirectory: jest.fn(),
         getPublicUrl: jest.fn().mockImplementation((key: string) => `https://pub-test.r2.dev/${key}`),
      } as unknown as jest.Mocked<CloudflareR2Provider>;

      mockEventPublisher = {
         publishTranscodeRequested: jest.fn(),
         publishTranscodeCompleted: jest.fn(),
         publishTranscodeFailed: jest.fn(),
      };

      service = new MediaService(mockRepository, mockStorageFactory, mockR2Provider, mockEventPublisher);
   });

   describe('initiateMultipartUpload', () => {
      it('should initialize multipart upload and return part presigned URLs', async () => {
         mockR2Provider.initiateMultipartUpload.mockResolvedValueOnce('upload-abc');
         mockR2Provider.generatePartUploadUrls.mockResolvedValueOnce([
            { partNumber: 1, uploadUrl: 'https://r2.test/part1' },
            { partNumber: 2, uploadUrl: 'https://r2.test/part2' },
         ]);

         mockRepository.create.mockResolvedValueOnce({
            id: 'media-123',
            userId: 'user-456',
            provider: MEDIA_PROVIDERS.CLOUDFLARE_R2,
            type: MEDIA_TYPES.VIDEO,
            url: 'https://pub-test.r2.dev/omni/videos/raw/cooking.mp4',
            key: 'omni/videos/raw/cooking.mp4',
            mimeType: 'video/mp4',
            size: 50000000,
            status: MEDIA_STATUSES.PENDING,
            metadata: null,
            createdAt: new Date(),
            updatedAt: new Date(),
         });

         const result = await service.initiateMultipartUpload('user-456', {
            fileName: 'cooking.mp4',
            mimeType: 'video/mp4',
            partsCount: 2,
            fileSize: 50000000,
         });

         expect(result.mediaId).toBe('media-123');
         expect(result.uploadId).toBe('upload-abc');
         expect(result.parts).toHaveLength(2);
         expect(mockRepository.create).toHaveBeenCalledTimes(1);
      });
   });

   describe('completeMultipartUpload', () => {
      it('should complete multipart in R2, transition status to PROCESSING and emit transcode event', async () => {
         const existingMedia = {
            id: 'media-123',
            userId: 'user-456',
            provider: MEDIA_PROVIDERS.CLOUDFLARE_R2,
            type: MEDIA_TYPES.VIDEO,
            url: 'https://pub-test.r2.dev/omni/videos/raw/cooking.mp4',
            key: 'omni/videos/raw/cooking.mp4',
            mimeType: 'video/mp4',
            size: 50000000,
            status: MEDIA_STATUSES.PENDING,
            metadata: null,
            createdAt: new Date(),
            updatedAt: new Date(),
         };

         mockRepository.findById.mockResolvedValueOnce(existingMedia);
         mockR2Provider.completeMultipartUpload.mockResolvedValueOnce(
            'https://pub-test.r2.dev/omni/videos/raw/cooking.mp4',
         );
         mockRepository.update.mockResolvedValueOnce({
            ...existingMedia,
            status: MEDIA_STATUSES.PROCESSING as never,
         });

         const result = await service.completeMultipartUpload('user-456', {
            mediaId: 'media-123',
            uploadId: 'upload-abc',
            parts: [{ partNumber: 1, etag: 'etag-1' }],
         });

         expect(result.status).toBe(MEDIA_STATUSES.PROCESSING);
         expect(mockR2Provider.completeMultipartUpload).toHaveBeenCalledWith(
            'omni/videos/raw/cooking.mp4',
            'upload-abc',
            [{ partNumber: 1, etag: 'etag-1' }],
         );
         expect(mockEventPublisher.publishTranscodeRequested).toHaveBeenCalledWith({
            mediaId: 'media-123',
            key: 'omni/videos/raw/cooking.mp4',
            mimeType: 'video/mp4',
            userId: 'user-456',
         });
      });

      it('should throw ForbiddenException if user does not own media entity', async () => {
         mockRepository.findById.mockResolvedValueOnce({
            id: 'media-123',
            userId: 'different-user',
            provider: MEDIA_PROVIDERS.CLOUDFLARE_R2,
            type: MEDIA_TYPES.VIDEO,
            url: 'https://pub-test.r2.dev/omni/videos/raw/cooking.mp4',
            key: 'omni/videos/raw/cooking.mp4',
            mimeType: 'video/mp4',
            size: 50000000,
            status: MEDIA_STATUSES.PENDING,
            metadata: null,
            createdAt: new Date(),
            updatedAt: new Date(),
         });

         await expect(
            service.completeMultipartUpload('user-456', {
               mediaId: 'media-123',
               uploadId: 'upload-abc',
               parts: [{ partNumber: 1, etag: 'etag-1' }],
            }),
         ).rejects.toThrow();
      });
   });
});
