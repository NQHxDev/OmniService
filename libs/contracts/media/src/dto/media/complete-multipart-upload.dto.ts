import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { plainToInstance, Transform, Type } from 'class-transformer';
import {
   ArrayNotEmpty,
   IsArray,
   IsInt,
   IsNotEmpty,
   IsOptional,
   IsString,
   IsUUID,
   Min,
   ValidateNested,
} from 'class-validator';

export class CompletedPartDto {
   @ApiProperty({
      description: '1-indexed part number matching the chunk upload',
      example: 1,
   })
   @IsInt()
   @Min(1)
   partNumber!: number;

   @ApiProperty({
      description: 'Entity tag (ETag) returned by Cloudflare R2 in the PUT part response header',
      example: '"9b2cf535f27731c974343645a3985328"',
   })
   @IsString()
   @IsNotEmpty()
   etag!: string;

   @ApiPropertyOptional({
      description: 'Alias for etag (commonly formatted as eTag in Mobile/Flutter clients)',
      example: '"9b2cf535f27731c974343645a3985328"',
   })
   @IsOptional()
   @IsString()
   eTag?: string;

   @ApiPropertyOptional({
      description: 'Alias for etag (standard AWS S3 SDK capitalization)',
      example: '"9b2cf535f27731c974343645a3985328"',
   })
   @IsOptional()
   @IsString()
   ETag?: string;
}

export class CompleteMultipartUploadDto {
   @ApiProperty({
      description: 'Unique media identifier created during multipart initiate',
      example: 'f81d4fae-7dec-11d0-a765-00a0c91e6bf6',
   })
   @IsUUID()
   @IsNotEmpty()
   mediaId!: string;

   @ApiProperty({
      description: 'Cloudflare R2 multipart upload identifier returned during initiate',
      example: '2~V1xabcde',
   })
   @IsString()
   @IsNotEmpty()
   uploadId!: string;

   @ApiProperty({
      description: 'Ordered list of parts with their corresponding ETags',
      type: [CompletedPartDto],
   })
   @IsArray()
   @ArrayNotEmpty()
   @ValidateNested({ each: true })
   @Type(() => CompletedPartDto)
   @Transform(({ value }: { value: unknown }) => {
      if (!Array.isArray(value)) return value;
      const list = value as unknown[];
      return list.map((part: unknown): unknown => {
         if (part && typeof part === 'object') {
            const raw = part as Record<string, unknown>;
            const resolvedEtag = (raw['etag'] ?? raw['eTag'] ?? raw['ETag']) as string | undefined;
            return plainToInstance(CompletedPartDto, {
               ...raw,
               etag: resolvedEtag,
            });
         }
         return part;
      });
   })
   parts!: CompletedPartDto[];
}
