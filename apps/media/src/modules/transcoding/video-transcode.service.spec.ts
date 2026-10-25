import { VideoTranscodeService } from '@media/modules/transcoding/video-transcode.service';
import type { CloudflareR2Provider } from '@media/storage/providers/r2.provider';
import type { MediaConfigService } from '@media/config';
import type { DiskGuardService } from '@media/modules/transcoding/services/disk-guard.service';
import type { TranscodeStrategyFactory } from '@media/modules/transcoding/strategies/transcode-strategy.factory';

describe('VideoTranscodeService', () => {
   let service: VideoTranscodeService;
   let mockR2Provider: jest.Mocked<CloudflareR2Provider>;
   let mockConfigService: jest.Mocked<MediaConfigService>;
   let mockDiskGuard: jest.Mocked<DiskGuardService>;
   let mockStrategyFactory: jest.Mocked<TranscodeStrategyFactory>;

   beforeEach(() => {
      mockR2Provider = {
         downloadFile: jest.fn().mockResolvedValue(undefined),
         uploadDirectory: jest.fn().mockResolvedValue([]),
         getPublicUrl: jest.fn().mockImplementation((key: string) => `https://pub-test.r2.dev/${key}`),
      } as unknown as jest.Mocked<CloudflareR2Provider>;

      mockConfigService = {
         ffmpegPath: 'ffmpeg',
         ffprobePath: 'ffprobe',
         transcodeMinFreeDiskBytes: 10 * 1024 * 1024 * 1024,
      } as unknown as jest.Mocked<MediaConfigService>;

      mockDiskGuard = {
         assertSufficientDiskSpace: jest.fn().mockResolvedValue(undefined),
         hasSufficientSpace: jest.fn().mockResolvedValue(true),
         getDiskSpace: jest.fn().mockResolvedValue({
            freeBytes: 50 * 1024 * 1024 * 1024,
            totalBytes: 100 * 1024 * 1024 * 1024,
            freeGb: 50,
            totalGb: 100,
         }),
      } as unknown as jest.Mocked<DiskGuardService>;

      mockStrategyFactory = {
         resolveStrategy: jest.fn().mockReturnValue({
            name: 'SinglePassFfmpegStrategy',
            supports: jest.fn().mockReturnValue(true),
            transcode: jest.fn().mockResolvedValue({
               resolutions: ['1080p', '720p', '360p'],
               cloudManaged: false,
            }),
         }),
      } as unknown as jest.Mocked<TranscodeStrategyFactory>;

      service = new VideoTranscodeService(mockR2Provider, mockConfigService, mockDiskGuard, mockStrategyFactory);
   });

   it('should instantiate service with validated config and disk guard', () => {
      expect(service).toBeDefined();
   });

   describe('determineLadder', () => {
      it('should return full ladder for 1080p source', () => {
         const ladder = service.determineLadder(1080);
         expect(ladder.map((v) => v.name)).toEqual(['1080p', '720p', '360p']);
      });

      it('should exclude 1080p for 720p source', () => {
         const ladder = service.determineLadder(720);
         expect(ladder.map((v) => v.name)).toEqual(['720p', '360p']);
      });

      it('should always include at least 360p for low resolution source', () => {
         const ladder = service.determineLadder(240);
         expect(ladder.map((v) => v.name)).toEqual(['360p']);
      });
   });
});
