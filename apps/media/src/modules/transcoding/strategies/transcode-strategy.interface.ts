import type { IVideoProbeResult, IVideoVariantConfig } from '@media/modules/transcoding/transcoding.interface';

export const TRANSCODE_STRATEGY = Symbol('TRANSCODE_STRATEGY');

export interface ITranscodeContext {
   mediaId: string;
   rawFilePath: string;
   outputDir: string;
   fileSizeBytes: number;
   probe: IVideoProbeResult;
   ladder: IVideoVariantConfig[];
}

export interface ITranscodeStrategyResult {
   resolutions: string[];
   cloudManaged?: boolean;
   provider?: string;
}

export interface ITranscodeStrategy {
   readonly name: string;
   supports(context: ITranscodeContext): boolean;
   transcode(context: ITranscodeContext): Promise<ITranscodeStrategyResult>;
}
