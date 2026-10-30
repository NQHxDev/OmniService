import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { z } from 'zod';

export const GetUserInterestsSchema = z.object({
   userId: z.string().min(1),
   limit: z.number().int().positive().default(5),
});

export class GetUserInterestsQueryDto {
   @ApiPropertyOptional({
      description: 'Maximum number of top category affinities to return (default 5, min 1, max 50)',
      example: 5,
      default: 5,
      minimum: 1,
      maximum: 50,
   })
   @IsOptional()
   @Type(() => Number)
   @IsInt()
   @Min(1)
   @Max(50)
   limit?: number = 5;
}

export class GetUserInterestsDto extends GetUserInterestsQueryDto {
   @ApiProperty({
      description: 'Unique UUID identifier of the target user',
      example: '0192e21b-0001-7000-8000-000000000001',
   })
   @IsString()
   userId!: string;
}

export class CategoryScoreItemDto {
   @ApiProperty({
      description: 'Unique category identifier or slug',
      example: 'vietnamese-cuisine',
   })
   categoryId!: string;

   @ApiProperty({
      description: 'Current accumulated content interest affinity score',
      example: 18.5,
   })
   score!: number;
}

export class GetUserInterestsResponseDto {
   @ApiProperty({
      description: 'Target user unique UUID',
      example: '0192e21b-0001-7000-8000-000000000001',
   })
   userId!: string;

   @ApiProperty({
      description: 'Top categories ranked in descending order of behavioral affinity score',
      type: [CategoryScoreItemDto],
   })
   topCategories!: CategoryScoreItemDto[];

   @ApiProperty({
      description: 'List of recently seen video identifiers (TTL 3 days) used for feed deduplication',
      example: ['0192e21b-0003-7000-8000-000000000002', '0192e21b-0003-7000-8000-000000000003'],
      type: [String],
   })
   seenVideoIds!: string[];
}
