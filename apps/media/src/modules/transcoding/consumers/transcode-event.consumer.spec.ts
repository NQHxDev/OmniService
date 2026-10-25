import { MEDIA_STATUSES } from '@contracts/media';
import { TranscodeEventConsumer } from '@media/modules/transcoding/consumers/transcode-event.consumer';
import type { VideoTranscodeService } from '@media/modules/transcoding/video-transcode.service';
import type { IMediaEventPublisher } from '@media/modules/transcoding/publishers/media-event.publisher.interface';
import type { IMediaRepository } from '@media/modules/media/repositories/media.repository.interface';
import type { RmqService } from '@common';

describe('TranscodeEventConsumer', () => {
   let consumer: TranscodeEventConsumer;
   let mockTranscodeService: jest.Mocked<VideoTranscodeService>;
   let mockEventPublisher: jest.Mocked<IMediaEventPublisher>;
   let mockRepository: jest.Mocked<IMediaRepository>;
   let mockRmqService: jest.Mocked<RmqService>;

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
         handleError: jest.fn(),
      } as unknown as jest.Mocked<RmqService>;

      consumer = new TranscodeEventConsumer(mockTranscodeService, mockEventPublisher, mockRepository, mockRmqService);
   });

   describe('handleTranscodeRequestedFromRmq', () => {
      it('should execute transcodeVideo and publish transcode completed event', async () => {
         mockTranscodeService.transcodeVideo.mockResolvedValueOnce({
            mediaId: 'media-123',
            hlsMasterUrl: 'https://r2.test/omni/videos/processed/media-123/master.m3u8',
            thumbnailUrl: 'https://r2.test/omni/videos/processed/media-123/thumbnail.jpg',
            duration: 120.5,
            resolutions: ['1080p', '720p', '360p'],
         });

         await consumer.handleTranscodeRequestedFromRmq({
            mediaId: 'media-123',
            key: 'omni/videos/raw/cooking.mp4',
            mimeType: 'video/mp4',
            userId: 'user-456',
         });

         expect(mockTranscodeService.transcodeVideo).toHaveBeenCalledWith('media-123', 'omni/videos/raw/cooking.mp4');
         expect(mockEventPublisher.publishTranscodeCompleted).toHaveBeenCalledWith({
            mediaId: 'media-123',
            hlsMasterUrl: 'https://r2.test/omni/videos/processed/media-123/master.m3u8',
            thumbnailUrl: 'https://r2.test/omni/videos/processed/media-123/thumbnail.jpg',
            duration: 120.5,
            resolutions: ['1080p', '720p', '360p'],
         });
      });

      it('should publish transcode failed event if transcodeVideo throws', async () => {
         mockTranscodeService.transcodeVideo.mockRejectedValueOnce(new Error('FFmpeg corrupted frame'));

         await consumer.handleTranscodeRequestedFromRmq({
            mediaId: 'media-123',
            key: 'omni/videos/raw/corrupted.mp4',
            mimeType: 'video/mp4',
            userId: 'user-456',
         });

         expect(mockEventPublisher.publishTranscodeFailed).toHaveBeenCalledWith({
            mediaId: 'media-123',
            error: 'FFmpeg corrupted frame',
         });
      });
   });

   describe('handleTranscodeCompletedFromRmq', () => {
      it('should transition media status to READY and save HLS metadata', async () => {
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

         await consumer.handleTranscodeCompletedFromRmq({
            mediaId: 'media-123',
            hlsMasterUrl: 'https://r2.test/master.m3u8',
            thumbnailUrl: 'https://r2.test/thumb.jpg',
            duration: 45.2,
            resolutions: ['720p', '360p'],
         });

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
      });
   });

   describe('handleTranscodeFailedFromRmq', () => {
      it('should transition media status to FAILED and record error in metadata', async () => {
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

         await consumer.handleTranscodeFailedFromRmq({
            mediaId: 'media-123',
            error: 'Transcoding timeout',
         });

         expect(mockRepository.update).toHaveBeenCalledWith('media-123', {
            status: MEDIA_STATUSES.FAILED,
            metadata: {
               transcodeError: 'Transcoding timeout',
            },
         });
      });
   });
});
