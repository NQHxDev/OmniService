import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

export class ConfirmUploadDto {
   @ApiProperty({
      description: 'Unique identifier of the media entity created during upload intent',
      example: 'f81d4fae-7dec-11d0-a765-00a0c91e6bf6',
   })
   @IsUUID()
   @IsNotEmpty()
   mediaId!: string;

   @ApiPropertyOptional({
      description: 'Verified file size in bytes after client upload completion',
      example: 204850,
   })
   @IsOptional()
   @IsNumber()
   size?: number;

   @ApiPropertyOptional({
      description: 'Image or video width in pixels',
      example: 1920,
   })
   @IsOptional()
   @IsNumber()
   width?: number;

   @ApiPropertyOptional({
      description: 'Image or video height in pixels',
      example: 1080,
   })
   @IsOptional()
   @IsNumber()
   height?: number;

   @ApiPropertyOptional({
      description: 'Video duration in seconds (optional for images/documents)',
      example: 45.5,
   })
   @IsOptional()
   @IsNumber()
   duration?: number;

   @ApiPropertyOptional({
      description: 'Public URL to video thumbnail or poster image',
      example: 'https://pub-xxx.r2.dev/omni/posts/thumbnails/thumb_123.jpg',
   })
   @IsOptional()
   @IsString()
   thumbnailUrl?: string;
}
