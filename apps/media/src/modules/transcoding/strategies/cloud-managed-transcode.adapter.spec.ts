import { CloudManagedTranscodeAdapter } from '@media/modules/transcoding/strategies/cloud-managed-transcode.adapter';
import type { MediaConfigService } from '@media/config';
import { CLOUD_TRANSCODE_PROVIDERS } from '@contracts/media';
import type { ITranscodeContext } from '@media/modules/transcoding/strategies/transcode-strategy.interface';

describe('CloudManagedTranscodeAdapter', () => {
   let adapter: CloudManagedTranscodeAdapter;
   let mockConfigService: jest.Mocked<MediaConfigService>;

   beforeEach(() => {
      mockConfigService = {
         transcodeOffloadMaxSizeBytes: 1024 * 1024 * 1024,
         transcodeOffloadMaxDurationSec: 1800,
         cloudTranscodeProvider: CLOUD_TRANSCODE_PROVIDERS.CLOUDFLARE_STREAM,
      } as unknown as jest.Mocked<MediaConfigService>;

      adapter = new CloudManagedTranscodeAdapter(mockConfigService);
   });

   it('should be defined', () => {
      expect(adapter).toBeDefined();
      expect(adapter.name).toBe('CloudManagedTranscodeAdapter');
   });

   describe('supports', () => {
      it('should return true if file size exceeds threshold', () => {
         const context: ITranscodeContext = {
            mediaId: '1',
            rawFilePath: '/tmp/test.mp4',
            outputDir: '/tmp/hls',
            fileSizeBytes: 2 * 1024 * 1024 * 1024,
            probe: { duration: 100, width: 1920, height: 1080, hasAudio: true },
            ladder: [],
         };

         expect(adapter.supports(context)).toBe(true);
      });

      it('should return true if video duration exceeds threshold', () => {
         const context: ITranscodeContext = {
            mediaId: '1',
            rawFilePath: '/tmp/test.mp4',
            outputDir: '/tmp/hls',
            fileSizeBytes: 100 * 1024 * 1024,
            probe: { duration: 2000, width: 1920, height: 1080, hasAudio: true },
            ladder: [],
         };

         expect(adapter.supports(context)).toBe(true);
      });

      it('should return false if neither size nor duration exceeds threshold', () => {
         const context: ITranscodeContext = {
            mediaId: '1',
            rawFilePath: '/tmp/test.mp4',
            outputDir: '/tmp/hls',
            fileSizeBytes: 50 * 1024 * 1024,
            probe: { duration: 60, width: 1920, height: 1080, hasAudio: true },
            ladder: [],
         };

         expect(adapter.supports(context)).toBe(false);
      });
   });

   describe('transcode', () => {
      it('should return resolutions with configured cloud transcode provider', async () => {
         const context: ITranscodeContext = {
            mediaId: 'cloud-media',
            rawFilePath: '/tmp/test.mp4',
            outputDir: '/tmp/hls',
            fileSizeBytes: 2 * 1024 * 1024 * 1024,
            probe: { duration: 3600, width: 1920, height: 1080, hasAudio: true },
            ladder: [
               { name: '1080p', width: 1920, height: 1080, bitrate: '4500k', audioBitrate: '192k' },
               { name: '720p', width: 1280, height: 720, bitrate: '2500k', audioBitrate: '128k' },
            ],
         };

         const result = await adapter.transcode(context);

         expect(result.cloudManaged).toBe(true);
         expect(result.provider).toBe(CLOUD_TRANSCODE_PROVIDERS.CLOUDFLARE_STREAM);
         expect(result.resolutions).toEqual(['1080p', '720p']);
      });
   });
});
