import { Injectable, Logger } from '@nestjs/common';
import { SinglePassFfmpegStrategy } from '@media/modules/transcoding/strategies/single-pass-ffmpeg.strategy';
import { CloudManagedTranscodeAdapter } from '@media/modules/transcoding/strategies/cloud-managed-transcode.adapter';
import type {
   ITranscodeContext,
   ITranscodeStrategy,
} from '@media/modules/transcoding/strategies/transcode-strategy.interface';

@Injectable()
export class TranscodeStrategyFactory {
   private readonly logger = new Logger(TranscodeStrategyFactory.name);

   constructor(
      private readonly singlePassStrategy: SinglePassFfmpegStrategy,
      private readonly cloudAdapter: CloudManagedTranscodeAdapter,
   ) {}

   resolveStrategy(context: ITranscodeContext): ITranscodeStrategy {
      if (this.cloudAdapter.supports(context)) {
         this.logger.log(
            `Strategy selected: ${this.cloudAdapter.name} (file size ${context.fileSizeBytes}B or duration ${context.probe.duration}s exceeds threshold)`,
         );
         return this.cloudAdapter;
      }

      this.logger.log(`Strategy selected: ${this.singlePassStrategy.name} (Single-Pass Multi-Ladder local worker)`);
      return this.singlePassStrategy;
   }
}
