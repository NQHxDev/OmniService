import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
   IsArray,
   IsBoolean,
   IsInt,
   IsNotEmpty,
   IsOptional,
   IsString,
   IsUUID,
   Min,
   ValidateNested,
} from 'class-validator';
import { z } from 'zod';

export const WatchIntervalSchema = z.object({
   startMs: z.number().int().nonnegative(),
   endMs: z.number().int().nonnegative(),
});

export const RecordWatchSessionSchema = z.object({
   sessionId: z.string().uuid().optional(),
   userId: z.string().min(1).optional(),
   videoId: z.string().min(1),
   watchDurationMs: z.number().int().nonnegative(),
   videoDurationMs: z.number().int().positive(),
   isCompleted: z.boolean().default(false).optional(),
   loopCount: z.number().int().nonnegative().default(0).optional(),
   categoryIds: z.array(z.string()).default([]).optional(),
   tagIds: z.array(z.string()).default([]).optional(),
   intervals: z.array(WatchIntervalSchema).default([]).optional(),
});

export class WatchIntervalDto {
   @ApiProperty({
      description: 'Start timestamp of watched segment in milliseconds',
      example: 0,
      minimum: 0,
   })
   @Type(() => Number)
   @IsInt()
   @Min(0)
   startMs!: number;

   @ApiProperty({
      description: 'End timestamp of watched segment in milliseconds',
      example: 15000,
      minimum: 0,
   })
   @Type(() => Number)
   @IsInt()
   @Min(0)
   endMs!: number;
}

export class RecordWatchSessionDto {
   @ApiPropertyOptional({
      description: 'Client-generated tracking session UUID for idempotent event deduplication',
      example: '0192e21b-0002-7000-8000-000000000001',
   })
   @IsOptional()
   @IsUUID('4')
   sessionId?: string;

   @ApiPropertyOptional({
      description: 'User ID of the viewer (automatically populated by Gateway from JWT auth context)',
      example: '0192e21b-0001-7000-8000-000000000001',
   })
   @IsOptional()
   @IsString()
   userId?: string;

   @ApiProperty({
      description: 'Unique video or recipe post identifier being watched',
      example: '0192e21b-0003-7000-8000-000000000002',
   })
   @IsNotEmpty()
   @IsString()
   videoId!: string;

   @ApiProperty({
      description: 'Total active watch duration in milliseconds',
      example: 45000,
      minimum: 0,
   })
   @Type(() => Number)
   @IsInt()
   @Min(0)
   watchDurationMs!: number;

   @ApiProperty({
      description: 'Total length of the original video asset in milliseconds',
      example: 60000,
      minimum: 1,
   })
   @Type(() => Number)
   @IsInt()
   @Min(1)
   videoDurationMs!: number;

   @ApiPropertyOptional({
      description: 'Flag indicating whether playback completed to the end of the video',
      example: true,
      default: false,
   })
   @IsOptional()
   @IsBoolean()
   isCompleted?: boolean = false;

   @ApiPropertyOptional({
      description: 'Number of consecutive replay loops completed in this session',
      example: 1,
      default: 0,
      minimum: 0,
   })
   @IsOptional()
   @Type(() => Number)
   @IsInt()
   @Min(0)
   loopCount?: number = 0;

   @ApiPropertyOptional({
      description: 'Category identifiers linked to the video for affinity score updates',
      example: ['vietnamese-cuisine', 'soup-noodle'],
      type: [String],
      default: [],
   })
   @IsOptional()
   @IsArray()
   @IsString({ each: true })
   categoryIds?: string[] = [];

   @ApiPropertyOptional({
      description: 'Hashtags and keyword tag identifiers extracted from the video post',
      example: ['phobo', 'cooking'],
      type: [String],
      default: [],
   })
   @IsOptional()
   @IsArray()
   @IsString({ each: true })
   tagIds?: string[] = [];

   @ApiPropertyOptional({
      description: 'List of continuous watch intervals on the video timeline for accurate unique coverage',
      type: [WatchIntervalDto],
      example: [
         { startMs: 0, endMs: 15000 },
         { startMs: 20000, endMs: 35000 },
      ],
   })
   @IsOptional()
   @IsArray()
   @ValidateNested({ each: true })
   @Type(() => WatchIntervalDto)
   intervals?: WatchIntervalDto[];
}

export class RecordWatchSessionResponseDto {
   @ApiProperty({
      description: 'Indicates whether the watch session was successfully registered and scored',
      example: true,
   })
   success!: boolean;

   @ApiProperty({
      description: 'Standard i18n translation response key',
      example: 'ANALYZE.RECORD_SESSION_SUCCESS',
   })
   message!: string;

   @ApiProperty({
      description:
         'Calculated behavior score delta applied to user affinity (negative for quick skips, positive for completions/loops)',
      example: 3,
   })
   calculatedScoreDelta!: number;
}
