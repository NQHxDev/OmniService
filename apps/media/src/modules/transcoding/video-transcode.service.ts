import { Injectable, Logger } from '@nestjs/common';
import * as childProcess from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as util from 'util';
import { MEDIA_FOLDERS } from '@contracts/media';
import { CloudflareR2Provider } from '@media/storage/providers/r2.provider';
import type {
   ITranscodeResult,
   IVideoProbeResult,
   IVideoVariantConfig,
} from '@media/modules/transcoding/transcoding.interface';
import { MediaConfigService } from '@media/config';
import { DiskGuardService } from '@media/modules/transcoding/services/disk-guard.service';
import { TranscodeStrategyFactory } from '@media/modules/transcoding/strategies/transcode-strategy.factory';

const execFile = util.promisify(childProcess.execFile);

@Injectable()
export class VideoTranscodeService {
   private readonly logger = new Logger(VideoTranscodeService.name);

   constructor(
      private readonly r2Provider: CloudflareR2Provider,
      private readonly configService: MediaConfigService,
      private readonly diskGuardService: DiskGuardService,
      private readonly strategyFactory: TranscodeStrategyFactory,
   ) {}

   private get ffmpegPath(): string {
      return this.configService.ffmpegPath;
   }

   private get ffprobePath(): string {
      return this.configService.ffprobePath;
   }

   async transcodeVideo(mediaId: string, rawKey: string): Promise<ITranscodeResult> {
      const workDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), `omni-transcode-${mediaId}-`));
      const rawFilePath = path.join(workDir, 'raw-video.mp4');
      const outputDir = path.join(workDir, 'hls');

      this.logger.log(`Starting HLS transcoding pipeline for media ${mediaId} in scratch dir ${workDir}`);

      try {
         // 1. Pre-flight disk space check: protect node against ENOSPC scratch exhaustion
         await this.diskGuardService.assertSufficientDiskSpace(workDir, this.configService.transcodeMinFreeDiskBytes);

         await fs.promises.mkdir(outputDir, { recursive: true });

         // 2. Download raw video from Cloudflare R2
         this.logger.log(`Downloading raw video from R2 (${rawKey}) to ${rawFilePath}`);
         await this.r2Provider.downloadFile(rawKey, rawFilePath);

         const rawStat = await fs.promises.stat(rawFilePath);
         const fileSizeBytes = rawStat.size;

         // 3. Probe video metadata (duration, resolution, audio track presence)
         const probe = await this.probeVideo(rawFilePath);
         this.logger.log(
            `Probed video ${mediaId}: ${probe.width}x${probe.height}, duration=${probe.duration}s, hasAudio=${probe.hasAudio}`,
         );

         // 4. Extract thumbnail poster at 00:00:01
         const thumbnailPath = path.join(outputDir, 'thumbnail.jpg');
         await this.extractThumbnail(rawFilePath, thumbnailPath);

         // 5. Determine adaptive HLS ladder
         const ladder = this.determineLadder(probe.height);

         // 6. Execute transcode using Strategy Pattern (Single-Pass FFmpeg or Hybrid Cloud Offload)
         const transcodeContext = {
            mediaId,
            rawFilePath,
            outputDir,
            fileSizeBytes,
            probe,
            ladder,
         };

         const strategy = this.strategyFactory.resolveStrategy(transcodeContext);
         const strategyResult = await strategy.transcode(transcodeContext);

         // 7. Upload entire processed HLS package to Cloudflare R2
         const processedKeyPrefix = `${MEDIA_FOLDERS.PROCESSED_VIDEOS}/${mediaId}`;
         this.logger.log(`Uploading processed HLS directory to R2 under prefix ${processedKeyPrefix}`);
         await this.r2Provider.uploadDirectory(outputDir, processedKeyPrefix);

         const hlsMasterUrl = this.r2Provider.getPublicUrl(`${processedKeyPrefix}/master.m3u8`);
         const thumbnailUrl = this.r2Provider.getPublicUrl(`${processedKeyPrefix}/thumbnail.jpg`);

         this.logger.log(
            `HLS Transcoding completed successfully for media ${mediaId} (strategy: ${strategy.name}). Master HLS: ${hlsMasterUrl}`,
         );

         return {
            mediaId,
            hlsMasterUrl,
            thumbnailUrl,
            duration: Math.round(probe.duration * 100) / 100,
            resolutions: strategyResult.resolutions,
         };
      } catch (error) {
         this.logger.error(`Transcoding failed for media ${mediaId}: ${(error as Error).message}`);
         throw error;
      } finally {
         try {
            await fs.promises.rm(workDir, { recursive: true, force: true });
            this.logger.debug(`Cleaned up scratch work directory: ${workDir}`);
         } catch (cleanupError) {
            this.logger.warn(`Failed to clean up scratch directory ${workDir}: ${(cleanupError as Error).message}`);
         }
      }
   }

   private async probeVideo(filePath: string): Promise<IVideoProbeResult> {
      try {
         const { stdout: durationOut } = await execFile(this.ffprobePath, [
            '-v',
            'error',
            '-show_entries',
            'format=duration',
            '-of',
            'default=noprint_wrappers=1:nokey=1',
            filePath,
         ]);
         const duration = parseFloat(durationOut.trim()) || 0;

         const { stdout: dimOut } = await execFile(this.ffprobePath, [
            '-v',
            'error',
            '-select_streams',
            'v:0',
            '-show_entries',
            'stream=width,height',
            '-of',
            'csv=s=x:p=0',
            filePath,
         ]);
         const parts = dimOut.trim().split('x');
         const width = parseInt(parts[0], 10) || 1920;
         const height = parseInt(parts[1], 10) || 1080;

         let hasAudio = false;
         try {
            const { stdout: audioOut } = await execFile(this.ffprobePath, [
               '-v',
               'error',
               '-select_streams',
               'a:0',
               '-show_entries',
               'stream=codec_type',
               '-of',
               'default=noprint_wrappers=1:nokey=1',
               filePath,
            ]);
            hasAudio = audioOut.trim() === 'audio';
         } catch {
            hasAudio = false;
         }

         return { duration, width, height, hasAudio };
      } catch (error) {
         this.logger.warn(`ffprobe failed or binary not found, defaulting: ${(error as Error).message}`);
         return { duration: 0, width: 1920, height: 1080, hasAudio: true };
      }
   }

   private async extractThumbnail(rawFilePath: string, outputThumbPath: string): Promise<void> {
      try {
         await execFile(this.ffmpegPath, [
            '-y',
            '-ss',
            '00:00:01',
            '-i',
            rawFilePath,
            '-vframes',
            '1',
            '-q:v',
            '2',
            outputThumbPath,
         ]);
         this.logger.debug(`Extracted poster thumbnail to ${outputThumbPath}`);
      } catch (error) {
         this.logger.warn(`Failed to extract frame at 00:00:01, trying 00:00:00: ${(error as Error).message}`);
         await execFile(this.ffmpegPath, ['-y', '-i', rawFilePath, '-vframes', '1', '-q:v', '2', outputThumbPath]);
      }
   }

   determineLadder(sourceHeight: number): IVideoVariantConfig[] {
      const fullLadder: IVideoVariantConfig[] = [
         { name: '1080p', width: 1920, height: 1080, bitrate: '4500k', audioBitrate: '192k' },
         { name: '720p', width: 1280, height: 720, bitrate: '2500k', audioBitrate: '128k' },
         { name: '360p', width: 640, height: 360, bitrate: '800k', audioBitrate: '96k' },
      ];

      const ladder = fullLadder.filter((v) => v.height <= Math.max(sourceHeight, 360));
      return ladder.length > 0 ? ladder : [fullLadder[fullLadder.length - 1]];
   }
}
