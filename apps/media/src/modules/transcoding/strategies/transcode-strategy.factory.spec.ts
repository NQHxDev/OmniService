import { TranscodeStrategyFactory } from '@media/modules/transcoding/strategies/transcode-strategy.factory';
import type { SinglePassFfmpegStrategy } from '@media/modules/transcoding/strategies/single-pass-ffmpeg.strategy';
import type { CloudManagedTranscodeAdapter } from '@media/modules/transcoding/strategies/cloud-managed-transcode.adapter';
import type { ITranscodeContext } from '@media/modules/transcoding/strategies/transcode-strategy.interface';

describe('TranscodeStrategyFactory', () => {
   let factory: TranscodeStrategyFactory;
   let mockSinglePassStrategy: jest.Mocked<SinglePassFfmpegStrategy>;
   let mockCloudAdapter: jest.Mocked<CloudManagedTranscodeAdapter>;

   beforeEach(() => {
      mockSinglePassStrategy = {
         name: 'SinglePassFfmpegStrategy',
         supports: jest.fn().mockReturnValue(true),
         transcode: jest.fn(),
      } as unknown as jest.Mocked<SinglePassFfmpegStrategy>;

      mockCloudAdapter = {
         name: 'CloudManagedTranscodeAdapter',
         supports: jest.fn().mockReturnValue(false),
         transcode: jest.fn(),
      } as unknown as jest.Mocked<CloudManagedTranscodeAdapter>;

      factory = new TranscodeStrategyFactory(mockSinglePassStrategy, mockCloudAdapter);
   });

   it('should select SinglePassFfmpegStrategy for standard video uploads', () => {
      const mockContext: ITranscodeContext = {
         mediaId: 'media-1',
         rawFilePath: '/tmp/test.mp4',
         outputDir: '/tmp/hls',
         fileSizeBytes: 200 * 1024 * 1024,
         probe: { width: 1920, height: 1080, duration: 60, hasAudio: true },
         ladder: [{ name: '1080p', width: 1920, height: 1080, bitrate: '4500k', audioBitrate: '192k' }],
      };

      const strategy = factory.resolveStrategy(mockContext);
      expect(strategy.name).toBe('SinglePassFfmpegStrategy');
   });

   it('should select CloudManagedTranscodeAdapter when video exceeds threshold', () => {
      mockCloudAdapter.supports.mockReturnValueOnce(true);

      const mockContext: ITranscodeContext = {
         mediaId: 'media-heavy',
         rawFilePath: '/tmp/heavy.mp4',
         outputDir: '/tmp/hls',
         fileSizeBytes: 2 * 1024 * 1024 * 1024,
         probe: { width: 3840, height: 2160, duration: 3600, hasAudio: true },
         ladder: [{ name: '1080p', width: 1920, height: 1080, bitrate: '4500k', audioBitrate: '192k' }],
      };

      const strategy = factory.resolveStrategy(mockContext);
      expect(strategy.name).toBe('CloudManagedTranscodeAdapter');
   });
});
