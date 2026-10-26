import { ApiProperty } from '@nestjs/swagger';

export class MultipartPartUrlDto {
   @ApiProperty({
      description: '1-indexed part number',
      example: 1,
   })
   partNumber!: number;

   @ApiProperty({
      description: 'Presigned HTTP PUT URL for uploading this chunk directly to Cloudflare R2',
      example: 'https://pub-xxx.r2.dev/omni/videos/raw/video_123.mp4?partNumber=1&uploadId=xxx',
   })
   uploadUrl!: string;
}

export class InitiateMultipartUploadResponseDto {
   @ApiProperty({
      description: 'Unique identifier of the media entity registered in PENDING status',
      example: 'f81d4fae-7dec-11d0-a765-00a0c91e6bf6',
   })
   mediaId!: string;

   @ApiProperty({
      description: 'Cloudflare R2 multipart upload identifier',
      example: '2~V1xabcde',
   })
   uploadId!: string;

   @ApiProperty({
      description: 'Storage key where the assembled video will reside',
      example: 'omni/videos/raw/video_123.mp4',
   })
   key!: string;

   @ApiProperty({
      description: 'Public URL to the assembled raw object (accessible once finalized)',
      example: 'https://pub-xxx.r2.dev/omni/videos/raw/video_123.mp4',
   })
   publicUrl!: string;

   @ApiProperty({
      description: 'List of presigned PUT URLs for each chunk/part',
      type: [MultipartPartUrlDto],
   })
   parts!: MultipartPartUrlDto[];
}
