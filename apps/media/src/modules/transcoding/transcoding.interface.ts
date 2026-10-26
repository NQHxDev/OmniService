export interface ITranscodeResult {
   mediaId: string;
   hlsMasterUrl: string;
   thumbnailUrl: string;
   duration: number;
   resolutions: string[];
}

export interface IVideoProbeResult {
   duration: number;
   width: number;
   height: number;
   hasAudio: boolean;
}

export interface IVideoVariantConfig {
   name: string;
   width: number;
   height: number;
   bitrate: string;
   audioBitrate: string;
}
