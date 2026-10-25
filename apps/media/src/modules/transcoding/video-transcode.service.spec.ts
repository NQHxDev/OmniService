import { VideoTranscodeService } from '@media/modules/transcoding/video-transcode.service';
import type { CloudflareR2Provider } from '@media/storage/providers/r2.provider';
import type { MediaConfigService } from '@media/config';

describe('VideoTranscodeService', () => {
   let service: VideoTranscodeService;
   let mockR2Provider: jest.Mocked<CloudflareR2Provider>;
   let mockConfigService: jest.Mocked<MediaConfigService>;

   beforeEach(() => {
      mockR2Provider = {
         downloadFile: jest.fn().mockResolvedValue(undefined),
         uploadDirectory: jest.fn().mockResolvedValue([]),
         getPublicUrl: jest.fn().mockImplementation((key: string) => `https://pub-test.r2.dev/${key}`),
      } as unknown as jest.Mocked<CloudflareR2Provider>;

      mockConfigService = {
         ffmpegPath: 'ffmpeg',
         ffprobePath: 'ffprobe',
      } as unknown as jest.Mocked<MediaConfigService>;

      service = new VideoTranscodeService(mockR2Provider, mockConfigService);
   });

   it('should instantiate service with validated config', () => {
      expect(service).toBeDefined();
   });

   describe('determineLadder', () => {
      it('should return full ladder for 1080p source', () => {
         const ladder = (
            service as unknown as { determineLadder: (h: number) => Array<{ name: string }> }
         ).determineLadder(1080);
         expect(ladder.map((v) => v.name)).toEqual(['1080p', '720p', '360p']);
      });

      it('should exclude 1080p for 720p source', () => {
         const ladder = (
            service as unknown as { determineLadder: (h: number) => Array<{ name: string }> }
         ).determineLadder(720);
         expect(ladder.map((v) => v.name)).toEqual(['720p', '360p']);
      });

      it('should always include at least 360p for low resolution source', () => {
         const ladder = (
            service as unknown as { determineLadder: (h: number) => Array<{ name: string }> }
         ).determineLadder(240);
         expect(ladder.map((v) => v.name)).toEqual(['360p']);
      });
   });
});
