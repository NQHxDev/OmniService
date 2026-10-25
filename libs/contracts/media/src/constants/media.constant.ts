export const MEDIA_PROVIDERS = {
   CLOUDINARY: 'CLOUDINARY',
   CLOUDFLARE_R2: 'CLOUDFLARE_R2',
} as const;

export type MediaProvider = (typeof MEDIA_PROVIDERS)[keyof typeof MEDIA_PROVIDERS];

export const CLOUD_TRANSCODE_PROVIDERS = {
   CLOUDFLARE_STREAM: 'CLOUDFLARE_STREAM',
   AWS_MEDIACONVERT: 'AWS_MEDIACONVERT',
} as const;

export type CloudTranscodeProvider = (typeof CLOUD_TRANSCODE_PROVIDERS)[keyof typeof CLOUD_TRANSCODE_PROVIDERS];

export const MEDIA_TYPES = {
   IMAGE: 'IMAGE',
   VIDEO: 'VIDEO',
   AUDIO: 'AUDIO',
   DOCUMENT: 'DOCUMENT',
} as const;

export type MediaType = (typeof MEDIA_TYPES)[keyof typeof MEDIA_TYPES];

export const MEDIA_STATUSES = {
   PENDING: 'PENDING',
   PROCESSING: 'PROCESSING',
   READY: 'READY',
   FAILED: 'FAILED',
} as const;

export type MediaStatus = (typeof MEDIA_STATUSES)[keyof typeof MEDIA_STATUSES];

export const MEDIA_ERROR_CODES = {
   MEDIA_NOT_FOUND: 'MEDIA.MEDIA_NOT_FOUND',
   INVALID_FILE_TYPE: 'MEDIA.INVALID_FILE_TYPE',
   FILE_TOO_LARGE: 'MEDIA.FILE_TOO_LARGE',
   UPLOAD_FAILED: 'MEDIA.UPLOAD_FAILED',
   UNSUPPORTED_PROVIDER: 'MEDIA.UNSUPPORTED_PROVIDER',
   FILE_REQUIRED: 'MEDIA.FILE_REQUIRED',
   CONFIRMATION_FAILED: 'MEDIA.CONFIRMATION_FAILED',
   MULTIPART_INITIATE_FAILED: 'MEDIA.MULTIPART_INITIATE_FAILED',
   MULTIPART_COMPLETE_FAILED: 'MEDIA.MULTIPART_COMPLETE_FAILED',
   TRANSCODE_FAILED: 'MEDIA.TRANSCODE_FAILED',
   INSUFFICIENT_STORAGE: 'MEDIA.INSUFFICIENT_STORAGE',
} as const;

export type MediaErrorCode = (typeof MEDIA_ERROR_CODES)[keyof typeof MEDIA_ERROR_CODES];

export const MEDIA_RESPONSE_MESSAGES = {
   GET_UPLOAD_URL_SUCCESS: 'MEDIA.GET_UPLOAD_URL_SUCCESS',
   UPLOAD_SUCCESS: 'MEDIA.UPLOAD_SUCCESS',
   CONFIRM_UPLOAD_SUCCESS: 'MEDIA.CONFIRM_UPLOAD_SUCCESS',
   GET_MEDIA_SUCCESS: 'MEDIA.GET_MEDIA_SUCCESS',
   DELETE_MEDIA_SUCCESS: 'MEDIA.DELETE_MEDIA_SUCCESS',
   INITIATE_MULTIPART_SUCCESS: 'MEDIA.INITIATE_MULTIPART_SUCCESS',
   COMPLETE_MULTIPART_SUCCESS: 'MEDIA.COMPLETE_MULTIPART_SUCCESS',
} as const;

export type MediaResponseMessage = (typeof MEDIA_RESPONSE_MESSAGES)[keyof typeof MEDIA_RESPONSE_MESSAGES];

export const MEDIA_PATTERNS = {
   GET_UPLOAD_URL: 'media.get_upload_url',
   UPLOAD_FILE: 'media.upload_file',
   CONFIRM_UPLOAD: 'media.confirm_upload',
   GET_MEDIA_BY_ID: 'media.get_by_id',
   DELETE_MEDIA: 'media.delete',
   INITIATE_MULTIPART_UPLOAD: 'media.multipart_initiate',
   COMPLETE_MULTIPART_UPLOAD: 'media.multipart_complete',
} as const;

export type MediaPattern = (typeof MEDIA_PATTERNS)[keyof typeof MEDIA_PATTERNS];

export const MEDIA_EVENTS = {
   UPLOADED: 'media.uploaded',
   PROCESSED: 'media.processed',
   DELETED: 'media.deleted',
   TRANSCODE_REQUESTED: 'media.video.transcode.requested',
   TRANSCODE_COMPLETED: 'media.video.transcode.completed',
   TRANSCODE_FAILED: 'media.video.transcode.failed',
} as const;

export type MediaEvent = (typeof MEDIA_EVENTS)[keyof typeof MEDIA_EVENTS];

export const MEDIA_FOLDERS = {
   AVATARS: 'omni/users/avatars',
   COVERS: 'omni/users/covers',
   POST_IMAGES: 'omni/posts/images',
   POST_VIDEOS: 'omni/posts/videos',
   DOCUMENTS: 'omni/documents',
   PROCESSED_VIDEOS: 'omni/videos/processed',
} as const;

export type MediaFolder = (typeof MEDIA_FOLDERS)[keyof typeof MEDIA_FOLDERS];

export const formatAvatarFileName = (userId: string, extension = 'jpg'): string => {
   return `avatar_${userId}.${extension}`;
};

export const formatCoverFileName = (userId: string, extension = 'jpg'): string => {
   return `cover_${userId}.${extension}`;
};

export const formatPostMediaFileName = (postId: string, index: number, extension: string): string => {
   return `post_${postId}_${index}.${extension}`;
};
