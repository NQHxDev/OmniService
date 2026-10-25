import type { MediaProvider, MediaStatus, MediaType } from '@contracts/media/constants/media.constant';

export interface IMedia {
   id: string;
   userId: string;
   provider: MediaProvider;
   type: MediaType;
   status: MediaStatus;
   url: string;
   key: string;
   mimeType: string;
   size: number;
   width?: number | null;
   height?: number | null;
   metadata?: Record<string, unknown> | null;
   createdAt: Date;
   updatedAt: Date;
}

export interface IGenerateUploadOptions {
   key: string;
   mimeType: string;
   type?: MediaType;
   size?: number;
   folder?: string;
   userId?: string;
   tags?: string[];
}

export interface IUploadOptions {
   key: string;
   mimeType?: string;
   folder?: string;
   tags?: string[];
   transformation?: Record<string, unknown>[];
}

export interface IUploadSignatureResult {
   provider: MediaProvider;
   method: 'PUT' | 'POST';
   uploadUrl?: string;
   publicUrl: string;
   key: string;
   signature?: string;
   timestamp?: number;
   apiKey?: string;
   cloudName?: string;
   headers?: Record<string, string>;
}

export interface IStorageUploadResult {
   provider: MediaProvider;
   key: string;
   url: string;
   format?: string;
   bytes?: number;
   width?: number;
   height?: number;
}

export interface IDeleteMediaResult {
   success: boolean;
}

export interface ICompletedPart {
   partNumber: number;
   etag: string;
}

export interface IMultipartPartUrl {
   partNumber: number;
   uploadUrl: string;
}

export interface IInitiateMultipartResult {
   mediaId: string;
   uploadId: string;
   key: string;
   publicUrl: string;
   parts: IMultipartPartUrl[];
}

export interface IVideoMetadata {
   duration?: number;
   thumbnailUrl?: string;
   hlsMasterUrl?: string;
   resolutions?: string[];
   [key: string]: unknown;
}

export interface ITranscodeRequestedEvent {
   mediaId: string;
   key: string;
   mimeType: string;
   userId: string;
}

export interface ITranscodeCompletedEvent {
   mediaId: string;
   hlsMasterUrl: string;
   thumbnailUrl: string;
   duration: number;
   resolutions: string[];
}

export interface ITranscodeFailedEvent {
   mediaId: string;
   error: string;
}
