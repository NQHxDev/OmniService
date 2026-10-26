import { MEDIA_STATUSES } from '@contracts/media';
import { TranscodeEventConsumer } from '@media/modules/transcoding/consumers/transcode-event.consumer';
import type { VideoTranscodeService } from '@media/modules/transcoding/video-transcode.service';
import type { IMediaEventPublisher } from '@media/modules/transcoding/publishers/media-event.publisher.interface';
import type { IMediaRepository } from '@media/modules/media/repositories/media.repository.interface';
import type { RmqService } from '@common';
import type { DiskGuardService } from '@media/modules/transcoding/services/disk-guard.service';
import type { RmqContext } from '@nestjs/microservices';

describe('TranscodeEventConsumer', () => {
   let consumer: TranscodeEventConsumer;
   let mockTranscodeService: jest.Mocked<VideoTranscodeService>;
   let mockEventPublisher: jest.Mocked<IMediaEventPublisher>;
   let mockRepository: jest.Mocked<IMediaRepository>;
   let mockRmqService: jest.Mocked<RmqService>;
   let mockDiskGuard: jest.Mocked<DiskGuardService>;
   let mockRmqContext: RmqContext;

   beforeEach(() => {
      mockTranscodeService = {
         transcodeVideo: jest.fn(),
      } as unknown as jest.Mocked<VideoTranscodeService>;

      mockEventPublisher = {
         publishTranscodeRequested: jest.fn(),
         publishTranscodeCompleted: jest.fn(),
         publishTranscodeFailed: jest.fn(),
      };

      mockRepository = {
         findById: jest.fn(),
         create: jest.fn(),
         update: jest.fn(),
         delete: jest.fn(),
         findByUserId: jest.fn(),
      };

      mockRmqService = {
         ack: jest.fn(),
         nack: jest.fn(),
         handleError: jest.fn().mockResolvedValue({ action: 'DLQ_POISON', retries: 0 }),
      } as unknown as jest.Mocked<RmqService>;

      mockDiskGuard = {
         hasSufficientSpace: jest.fn().mockResolvedValue(true),
         assertSufficientDiskSpace: jest.fn().mockResolvedValue(undefined),
         getDiskSpace: jest.fn().mockResolvedValue({
            freeBytes: 50 * 1024 * 1024 * 1024,
            totalBytes: 100 * 1024 * 1024 * 1024,
            freeGb: 50,
            totalGb: 100,
         }),
      } as unknown as jest.Mocked<DiskGuardService>;

      mockRmqContext = {
         getChannelRef: jest.fn(),
         getMessage: jest.fn(),
      } as unknown as RmqContext;

      consumer = new TranscodeEventConsumer(
         mockTranscodeService,
         mockEventPublisher,
         mockRepository,
         mockRmqService,
         mockDiskGuard,
      );
   });

   describe('handleTranscodeRequestedFromRmq', () => {
      it('should execute transcodeVideo, publish transcode completed event, and manually ACK only after completion', async () => {
         mockTranscodeService.transcodeVideo.mockResolvedValueOnce({
            mediaId: 'media-123',
            hlsMasterUrl: 'https://r2.test/omni/videos/processed/media-123/master.m3u8',
            thumbnailUrl: 'https://r2.test/omni/videos/processed/media-123/thumbnail.jpg',
            duration: 120.5,
            resolutions: ['1080p', '720p', '360p'],
         });

         await consumer.handleTranscodeRequestedFromRmq(
            {
               mediaId: 'media-123',
               key: 'omni/videos/raw/cooking.mp4',
               mimeType: 'video/mp4',
               userId: 'user-456',
            },
            mockRmqContext,
         );

         expect(mockDiskGuard.hasSufficientSpace).toHaveBeenCalled();
         expect(mockTranscodeService.transcodeVideo).toHaveBeenCalledWith('media-123', 'omni/videos/raw/cooking.mp4');
         expect(mockEventPublisher.publishTranscodeCompleted).toHaveBeenCalledWith({
            mediaId: 'media-123',
            hlsMasterUrl: 'https://r2.test/omni/videos/processed/media-123/master.m3u8',
            thumbnailUrl: 'https://r2.test/omni/videos/processed/media-123/thumbnail.jpg',
            duration: 120.5,
            resolutions: ['1080p', '720p', '360p'],
         });
         expect(mockRmqService.ack).toHaveBeenCalledWith(mockRmqContext);
      });

      it('should nack with requeue when scratch disk space is below safety threshold', async () => {
         mockDiskGuard.hasSufficientSpace.mockResolvedValueOnce(false);

         await consumer.handleTranscodeRequestedFromRmq(
            {
               mediaId: 'media-123',
               key: 'omni/videos/raw/cooking.mp4',
               mimeType: 'video/mp4',
               userId: 'user-456',
            },
            mockRmqContext,
         );

         expect(mockRmqService.nack).toHaveBeenCalledWith(mockRmqContext, true);
         expect(mockTranscodeService.transcodeVideo).not.toHaveBeenCalled();
         expect(mockRmqService.ack).not.toHaveBeenCalled();
      });

      it('should publish transcode failed event and route error to rmqService.handleError if transcodeVideo throws', async () => {
         const error = new Error('FFmpeg corrupted frame');
         mockTranscodeService.transcodeVideo.mockRejectedValueOnce(error);

         await consumer.handleTranscodeRequestedFromRmq(
            {
               mediaId: 'media-123',
               key: 'omni/videos/raw/corrupted.mp4',
               mimeType: 'video/mp4',
               userId: 'user-456',
            },
            mockRmqContext,
         );

         expect(mockEventPublisher.publishTranscodeFailed).toHaveBeenCalledWith({
            mediaId: 'media-123',
            error: 'FFmpeg corrupted frame',
         });
         expect(mockRmqService.handleError).toHaveBeenCalledWith(error, mockRmqContext, expect.any(Object));
         expect(mockRmqService.ack).not.toHaveBeenCalled();
      });
   });

   describe('handleTranscodeCompletedFromRmq', () => {
      it('should transition media status to READY and save HLS metadata, then ack context', async () => {
         mockRepository.findById.mockResolvedValueOnce({
            id: 'media-123',
            userId: 'user-456',
            provider: 'CLOUDFLARE_R2' as never,
            type: 'VIDEO' as never,
            url: 'https://r2.test/raw.mp4',
            key: 'omni/videos/raw/test.mp4',
            mimeType: 'video/mp4',
            size: 50000000,
            status: MEDIA_STATUSES.PROCESSING as never,
            metadata: null,
            createdAt: new Date(),
            updatedAt: new Date(),
         });

         await consumer.handleTranscodeCompletedFromRmq(
            {
               mediaId: 'media-123',
               hlsMasterUrl: 'https://r2.test/master.m3u8',
               thumbnailUrl: 'https://r2.test/thumb.jpg',
               duration: 45.2,
               resolutions: ['720p', '360p'],
            },
            mockRmqContext,
         );

         expect(mockRepository.update).toHaveBeenCalledWith('media-123', {
            status: MEDIA_STATUSES.READY,
            url: 'https://r2.test/master.m3u8',
            metadata: {
               hlsMasterUrl: 'https://r2.test/master.m3u8',
               thumbnailUrl: 'https://r2.test/thumb.jpg',
               duration: 45.2,
               resolutions: ['720p', '360p'],
            },
         });
         expect(mockRmqService.ack).toHaveBeenCalledWith(mockRmqContext);
      });
   });

   describe('handleTranscodeFailedFromRmq', () => {
      it('should transition media status to FAILED and record error in metadata, then ack context', async () => {
         mockRepository.findById.mockResolvedValueOnce({
            id: 'media-123',
            userId: 'user-456',
            provider: 'CLOUDFLARE_R2' as never,
            type: 'VIDEO' as never,
            url: 'https://r2.test/raw.mp4',
            key: 'omni/videos/raw/test.mp4',
            mimeType: 'video/mp4',
            size: 50000000,
            status: MEDIA_STATUSES.PROCESSING as never,
            metadata: null,
            createdAt: new Date(),
            updatedAt: new Date(),
         });

         await consumer.handleTranscodeFailedFromRmq(
            {
               mediaId: 'media-123',
               error: 'Transcoding timeout',
            },
            mockRmqContext,
         );

         expect(mockRepository.update).toHaveBeenCalledWith('media-123', {
            status: MEDIA_STATUSES.FAILED,
            metadata: {
               transcodeError: 'Transcoding timeout',
            },
         });
         expect(mockRmqService.ack).toHaveBeenCalledWith(mockRmqContext);
      });
   });
});
