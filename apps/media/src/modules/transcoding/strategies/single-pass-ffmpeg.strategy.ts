import { Injectable, Logger } from '@nestjs/common';
import * as childProcess from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';
import { MediaConfigService } from '@media/config';
import type {
   ITranscodeContext,
   ITranscodeStrategy,
   ITranscodeStrategyResult,
} from '@media/modules/transcoding/strategies/transcode-strategy.interface';
import type { IVideoVariantConfig } from '@media/modules/transcoding/transcoding.interface';

const execFile = util.promisify(childProcess.execFile);

@Injectable()
export class SinglePassFfmpegStrategy implements ITranscodeStrategy {
   readonly name = 'SinglePassFfmpegStrategy';
   private readonly logger = new Logger(SinglePassFfmpegStrategy.name);

   constructor(private readonly configService: MediaConfigService) {}

   supports(): boolean {
      // Primary self-hosted encoder strategy
      return true;
   }

   async transcode(context: ITranscodeContext): Promise<ITranscodeStrategyResult> {
      const { rawFilePath, outputDir, ladder, probe, mediaId } = context;
      const startTime = Date.now();

      this.logger.log(
         `Executing Single-Pass Multi-Ladder FFmpeg encoding for media ${mediaId} (${ladder.length} variants)`,
      );

      // Pre-create output variant subdirectories to prevent filesystem races
      await Promise.all(
         ladder.map((variant) => fs.promises.mkdir(path.join(outputDir, variant.name), { recursive: true })),
      );

      const args = this.buildSinglePassArgs(rawFilePath, outputDir, ladder, probe.hasAudio);

      this.logger.debug(`FFmpeg args: ${this.configService.ffmpegPath} ${args.join(' ')}`);

      try {
         await execFile(this.configService.ffmpegPath, args, { maxBuffer: 10 * 1024 * 1024 });
      } catch (error) {
         this.logger.error(`Single-Pass FFmpeg execution failed for media ${mediaId}: ${(error as Error).message}`);
         throw error;
      }

      // Verify that master.m3u8 exists; if not created by muxer, build it as fallback
      const masterPlaylistPath = path.join(outputDir, 'master.m3u8');
      const masterExists = await fs.promises
         .access(masterPlaylistPath)
         .then(() => true)
         .catch(() => false);

      if (!masterExists) {
         this.logger.warn(`FFmpeg did not output master.m3u8 directly. Generating fallback master playlist.`);
         await this.generateMasterPlaylist(outputDir, ladder, probe.hasAudio);
      }

      const elapsedMs = Date.now() - startTime;
      this.logger.log(
         `Single-Pass Multi-Ladder FFmpeg completed in ${elapsedMs}ms for media ${mediaId} (${ladder.map((v) => v.name).join(', ')})`,
      );

      return {
         resolutions: ladder.map((v) => v.name),
         cloudManaged: false,
      };
   }

   private buildSinglePassArgs(
      rawFilePath: string,
      outputDir: string,
      ladder: IVideoVariantConfig[],
      hasAudio: boolean,
   ): string[] {
      const count = ladder.length;

      // 1. Build filter_complex split and scaling branch
      const splitOutputs = ladder.map((_, i) => `[v${i}]`).join('');
      const filterBranches: string[] = [`[0:v]split=${count}${splitOutputs}`];

      ladder.forEach((variant, i) => {
         filterBranches.push(
            `[v${i}]scale=w=${variant.width}:h=${variant.height}:force_original_aspect_ratio=decrease,pad=ceil(iw/2)*2:ceil(ih/2)*2,format=yuv420p[v${i}out]`,
         );
      });

      const filterComplex = filterBranches.join('; ');

      const args: string[] = ['-y', '-i', rawFilePath, '-filter_complex', filterComplex];

      // 2. Map video streams with variant bitrates
      ladder.forEach((variant, i) => {
         const bitrateVal = parseInt(variant.bitrate, 10);
         args.push(
            '-map',
            `[v${i}out]`,
            `-c:v:${i}`,
            'libx264',
            `-profile:v:${i}`,
            'main',
            `-b:v:${i}`,
            variant.bitrate,
            `-maxrate:v:${i}`,
            variant.bitrate,
            `-bufsize:v:${i}`,
            `${bitrateVal * 2}k`,
         );
      });

      // 3. Map audio streams if present
      if (hasAudio) {
         ladder.forEach((variant, i) => {
            args.push('-map', '0:a', `-c:a:${i}`, 'aac', `-b:a:${i}`, variant.audioBitrate, '-ar', '44100');
         });
      } else {
         args.push('-an');
      }

      // 4. General encoding and HLS muxer settings
      args.push(
         '-preset',
         'veryfast',
         '-g',
         '48',
         '-sc_threshold',
         '0',
         '-f',
         'hls',
         '-hls_time',
         '6',
         '-hls_playlist_type',
         'vod',
         '-hls_flags',
         'independent_segments',
         '-master_pl_name',
         'master.m3u8',
      );

      // 5. Build var_stream_map: e.g. "v:0,a:0,name:1080p v:1,a:1,name:720p" or "v:0,name:1080p v:1,name:720p"
      const streamMap = ladder
         .map((variant, i) => (hasAudio ? `v:${i},a:${i},name:${variant.name}` : `v:${i},name:${variant.name}`))
         .join(' ');

      args.push(
         '-var_stream_map',
         streamMap,
         '-hls_segment_filename',
         path.join(outputDir, '%v', 'segment_%03d.ts'),
         path.join(outputDir, '%v', 'index.m3u8'),
      );

      return args;
   }

   private async generateMasterPlaylist(
      outputDir: string,
      ladder: IVideoVariantConfig[],
      hasAudio: boolean,
   ): Promise<void> {
      let masterContent = '#EXTM3U\n#EXT-X-VERSION:3\n';

      for (const variant of ladder) {
         const videoBandwidth = parseInt(variant.bitrate, 10) * 1000;
         const audioBandwidth = hasAudio ? parseInt(variant.audioBitrate, 10) * 1000 : 0;
         const totalBandwidth = videoBandwidth + audioBandwidth;

         masterContent += `#EXT-X-STREAM-INF:BANDWIDTH=${totalBandwidth},RESOLUTION=${variant.width}x${variant.height}\n`;
         masterContent += `${variant.name}/index.m3u8\n`;
      }

      const masterPath = path.join(outputDir, 'master.m3u8');
      await fs.promises.writeFile(masterPath, masterContent, 'utf-8');
   }
}
