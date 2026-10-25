import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsPositive, IsString, Max, Min } from 'class-validator';

export class InitiateMultipartUploadDto {
   @ApiProperty({
      description: 'Original name of the video file including extension',
      example: 'cooking-lesson-4k.mp4',
   })
   @IsString()
   @IsNotEmpty()
   fileName!: string;

   @ApiProperty({
      description: 'MIME type of the video file',
      example: 'video/mp4',
   })
   @IsString()
   @IsNotEmpty()
   mimeType!: string;

   @ApiProperty({
      description: 'Total number of chunks/parts to upload (between 1 and 10,000)',
      example: 10,
   })
   @IsInt()
   @Min(1)
   @Max(10000)
   partsCount!: number;

   @ApiPropertyOptional({
      description: 'Total estimated video file size in bytes',
      example: 104857600,
   })
   @IsOptional()
   @IsInt()
   @IsPositive()
   fileSize?: number;

   @ApiPropertyOptional({
      description: 'Custom destination folder namespace in Cloudflare R2 bucket',
      example: 'omni/videos/raw',
   })
   @IsOptional()
   @IsString()
   folder?: string;
}
