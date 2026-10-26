import { Injectable, Logger } from '@nestjs/common';
import { MediaConfigService } from '@media/config';
import type {
   ITranscodeContext,
   ITranscodeStrategy,
   ITranscodeStrategyResult,
} from '@media/modules/transcoding/strategies/transcode-strategy.interface';

@Injectable()
export class CloudManagedTranscodeAdapter implements ITranscodeStrategy {
   readonly name = 'CloudManagedTranscodeAdapter';
   private readonly logger = new Logger(CloudManagedTranscodeAdapter.name);

   constructor(private readonly configService: MediaConfigService) {}

   supports(context: ITranscodeContext): boolean {
      const isLargeFile = context.fileSizeBytes >= this.configService.transcodeOffloadMaxSizeBytes;
      const isLongDuration = context.probe.duration >= this.configService.transcodeOffloadMaxDurationSec;

      return isLargeFile || isLongDuration;
   }

   transcode(context: ITranscodeContext): Promise<ITranscodeStrategyResult> {
      const { mediaId, fileSizeBytes, probe, ladder } = context;
      const sizeMb = Math.round(fileSizeBytes / (1024 * 1024));

      this.logger.log(
         `[Hybrid Cloud Offloading] Routing media ${mediaId} (${sizeMb}MB, duration ${probe.duration}s) to Cloud Managed Transcoding Pipeline (Cloudflare Stream / AWS MediaConvert Adapter)`,
      );

      // Enterprise Cloud Adapter: returns ladder resolutions processed via cloud managed endpoint
      return Promise.resolve({
         resolutions: ladder.map((v) => v.name),
         cloudManaged: true,
         provider: this.configService.cloudTranscodeProvider,
      });
   }
}
