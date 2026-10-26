import type { Request } from 'express';
import { CORRELATION_ID_HEADER, type JwtPayload } from '@common';
import { MediaController } from '@gateway/modules/media/media.controller';
import type { MediaService } from '@gateway/modules/media/media.service';

describe('Gateway MediaController', () => {
   let controller: MediaController;
   let mockMediaService: jest.Mocked<MediaService>;

   const mockUser: JwtPayload = {
      sub: 'user-123',
      email: 'chef@example.com',
      roles: ['USER'],
      iat: 123456789,
      exp: 987654321,
      jti: 'session-123',
   };

   const mockReq = {
      headers: {
         [CORRELATION_ID_HEADER]: 'req-corr-123',
      },
   } as unknown as Request;

   beforeEach(() => {
      mockMediaService = {
         getUploadUrl: jest.fn(),
         uploadFile: jest.fn(),
         confirmUpload: jest.fn(),
         getMediaById: jest.fn(),
         deleteMedia: jest.fn(),
         initiateMultipartUpload: jest.fn(),
         completeMultipartUpload: jest.fn(),
      } as unknown as jest.Mocked<MediaService>;

      controller = new MediaController(mockMediaService);
   });

   describe('initiateMultipartUpload', () => {
      it('should delegate multipart initiation to mediaService with correlationId', async () => {
         const dto = {
            fileName: '4k-recipe.mp4',
            mimeType: 'video/mp4',
            partsCount: 5,
            fileSize: 52428800,
         };

         mockMediaService.initiateMultipartUpload.mockResolvedValueOnce({
            mediaId: 'media-789',
            uploadId: 'upload-xyz',
            key: 'omni/videos/raw/4k-recipe.mp4',
            publicUrl: 'https://pub-test.r2.dev/omni/videos/raw/4k-recipe.mp4',
            parts: [
               { partNumber: 1, uploadUrl: 'https://r2.test/part1' },
               { partNumber: 2, uploadUrl: 'https://r2.test/part2' },
            ],
         });

         const result = await controller.initiateMultipartUpload(dto, mockUser, mockReq);

         expect(mockMediaService.initiateMultipartUpload).toHaveBeenCalledWith(dto, mockUser, 'req-corr-123');
         expect(result.mediaId).toBe('media-789');
         expect(result.uploadId).toBe('upload-xyz');
      });
   });

   describe('completeMultipartUpload', () => {
      it('should delegate multipart completion to mediaService with correlationId', async () => {
         const dto = {
            mediaId: 'media-789',
            uploadId: 'upload-xyz',
            parts: [
               { partNumber: 1, etag: 'etag-1' },
               { partNumber: 2, etag: 'etag-2' },
            ],
         };

         mockMediaService.completeMultipartUpload.mockResolvedValueOnce({
            id: 'media-789',
            userId: 'user-123',
            provider: 'CLOUDFLARE_R2' as never,
            type: 'VIDEO' as never,
            url: 'https://pub-test.r2.dev/omni/videos/raw/4k-recipe.mp4',
            key: 'omni/videos/raw/4k-recipe.mp4',
            mimeType: 'video/mp4',
            size: 52428800,
            status: 'PROCESSING' as never,
            metadata: null,
            createdAt: new Date(),
            updatedAt: new Date(),
         });

         const result = await controller.completeMultipartUpload(dto, mockUser, mockReq);

         expect(mockMediaService.completeMultipartUpload).toHaveBeenCalledWith(dto, mockUser, 'req-corr-123');
         expect(result.status).toBe('PROCESSING');
      });
   });

   describe('confirmUpload', () => {
      it('should delegate confirmUpload to mediaService with correlationId', async () => {
         const dto = {
            mediaId: 'media-789',
            size: 102400,
            width: 1920,
            height: 1080,
         };

         mockMediaService.confirmUpload.mockResolvedValueOnce({
            id: 'media-789',
            userId: 'user-123',
            provider: 'CLOUDFLARE_R2' as never,
            type: 'IMAGE' as never,
            url: 'https://pub-test.r2.dev/omni/images/banner.jpg',
            key: 'omni/images/banner.jpg',
            mimeType: 'image/jpeg',
            size: 102400,
            status: 'READY' as never,
            metadata: { width: 1920, height: 1080 },
            createdAt: new Date(),
            updatedAt: new Date(),
         });

         const result = await controller.confirmUpload(dto, mockUser, mockReq);

         expect(mockMediaService.confirmUpload).toHaveBeenCalledWith(dto, mockUser, 'req-corr-123');
         expect(result.status).toBe('READY');
      });
   });
});
