import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MEDIA_PROVIDERS, type MediaProvider } from '@contracts/media/constants/media.constant';

export class UploadUrlResponseDto {
   @ApiProperty({
      description: 'Unique identifier of the reserved media record in PENDING state',
      example: 'f81d4fae-7dec-11d0-a765-00a0c91e6bf6',
   })
   mediaId!: string;

   @ApiProperty({
      description: 'Selected storage provider handling this asset upload',
      enum: MEDIA_PROVIDERS,
      example: MEDIA_PROVIDERS.CLOUDFLARE_R2,
   })
   provider!: MediaProvider;

   @ApiProperty({
      description:
         'HTTP method required for direct client upload (PUT for S3/R2 presigned URL, POST for Cloudinary/multipart)',
      example: 'PUT',
   })
   method!: string;

   @ApiPropertyOptional({
      description: 'Direct upload URL endpoint (e.g., presigned S3/R2 PUT URL or Cloudinary API URL)',
      example:
         'https://omniconnect.8c105792348723be568e322d01a2de79.r2.cloudflarestorage.com/omni/posts/videos/video_123.mp4',
   })
   uploadUrl?: string;

   @ApiPropertyOptional({
      description: 'Public URL where the asset will be accessible after successful upload',
      example: 'https://pub-50b1ab619efd4084959e011fe2e5a273.r2.dev/omni/posts/videos/video_123.mp4',
   })
   publicUrl?: string;

   @ApiPropertyOptional({
      description: 'Target storage key or path identifier',
      example: 'omni/posts/videos/video_123.mp4',
   })
   key?: string;

   @ApiPropertyOptional({
      description: 'Cryptographic SHA-1 signature authorizing direct client upload (Cloudinary)',
      example: 'bf9b9365c19dc5cf60b4a4cb88b39d1b0a82741d',
   })
   signature?: string;

   @ApiPropertyOptional({
      description: 'Unix timestamp in seconds when the signature was issued (Cloudinary)',
      example: 1712839200,
   })
   timestamp?: number;

   @ApiPropertyOptional({
      description: 'Public API Key for Cloudinary authentication',
      example: '815868176425211',
   })
   apiKey?: string;

   @ApiPropertyOptional({
      description: 'Cloudinary cloud name for resource destination',
      example: 'dbm3etf8n',
   })
   cloudName?: string;

   @ApiPropertyOptional({
      description: 'Additional form fields or headers needed for upload',
      type: Object,
      example: { 'Content-Type': 'video/mp4' },
   })
   headers?: Record<string, string>;
}
