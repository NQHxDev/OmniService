import { SinglePassFfmpegStrategy } from '@media/modules/transcoding/strategies/single-pass-ffmpeg.strategy';
import type { MediaConfigService } from '@media/config';
import type { ITranscodeContext } from '@media/modules/transcoding/strategies/transcode-strategy.interface';
import * as childProcess from 'child_process';
import * as fs from 'fs';

jest.mock('child_process', () => ({
   execFile: jest.fn(
      (
         _file: string,
         _args: string[],
         _opts: unknown,
         cb: (err: Error | null, stdout: string, stderr: string) => void,
      ) => {
         cb(null, '', '');
      },
   ),
}));

describe('SinglePassFfmpegStrategy', () => {
   let strategy: SinglePassFfmpegStrategy;
   let mockConfigService: jest.Mocked<MediaConfigService>;

   beforeEach(() => {
      mockConfigService = {
         ffmpegPath: 'ffmpeg',
      } as unknown as jest.Mocked<MediaConfigService>;

      strategy = new SinglePassFfmpegStrategy(mockConfigService);
   });

   it('should be defined and support transcoding', () => {
      expect(strategy).toBeDefined();
      expect(strategy.supports()).toBe(true);
      expect(strategy.name).toBe('SinglePassFfmpegStrategy');
   });

   describe('transcode', () => {
      it('should execute single-pass FFmpeg command and return variant resolutions', async () => {
         const mockContext: ITranscodeContext = {
            mediaId: 'media-test',
            rawFilePath: '/tmp/test.mp4',
            outputDir: '/tmp/hls',
            fileSizeBytes: 50 * 1024 * 1024,
            probe: { width: 1920, height: 1080, duration: 30, hasAudio: true },
            ladder: [
               { name: '1080p', width: 1920, height: 1080, bitrate: '4500k', audioBitrate: '192k' },
               { name: '720p', width: 1280, height: 720, bitrate: '2500k', audioBitrate: '128k' },
            ],
         };

         jest.spyOn(fs.promises, 'mkdir').mockResolvedValue(undefined);
         jest.spyOn(fs.promises, 'access').mockResolvedValue(undefined);

         const result = await strategy.transcode(mockContext);

         expect(result.resolutions).toEqual(['1080p', '720p']);
         expect(result.cloudManaged).toBe(false);
         expect(childProcess.execFile).toHaveBeenCalledWith(
            'ffmpeg',
            expect.arrayContaining([
               '-y',
               '-i',
               '/tmp/test.mp4',
               '-filter_complex',
               expect.stringContaining('split=2'),
               '-master_pl_name',
               'master.m3u8',
            ]),
            expect.any(Object),
            expect.any(Function),
         );
      });
   });
});
