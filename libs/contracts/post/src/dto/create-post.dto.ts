import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
   IsArray,
   IsBoolean,
   IsEnum,
   IsInt,
   IsNotEmpty,
   IsOptional,
   IsString,
   IsUrl,
   IsUUID,
   MaxLength,
   Min,
   ValidateNested,
} from 'class-validator';
import { POST_VISIBILITY, type PostVisibility } from '@contracts/post/constants';
import { CreatePostIngredientDto } from '@contracts/post/dto/create-post-ingredient.dto';
import { CreateRecipeDto } from '@contracts/post/dto/create-recipe.dto';

export class CreatePostDto {
   @ApiProperty({
      description: 'Title of recipe or post video',
      example: 'Cách nấu Phở Bò Nam Định chuẩn vị truyền thống',
   })
   @IsString()
   @IsNotEmpty()
   @MaxLength(200)
   title!: string;

   @ApiPropertyOptional({
      description: 'Caption or descriptive summary of the post (hashtags #tag will be automatically extracted)',
      example: 'Công thức nấu nước dùng phở bò thơm ngon ngọt thanh chuẩn vị Nam Định #phobo #nauan #monngon',
   })
   @IsString()
   @IsOptional()
   @MaxLength(5000)
   caption?: string;

   @ApiPropertyOptional({
      description: 'Media asset ID from Media Service',
      example: '0192e21b-0002-7000-8000-000000000005',
   })
   @IsUUID('4')
   @IsOptional()
   mediaId?: string;

   @ApiProperty({
      description: 'Direct video playback URL (hosted on Cloudflare R2)',
      example: 'https://pub-50b1ab619efd4084959e011fe2e5a273.r2.dev/videos/video_1.mp4',
   })
   @IsUrl()
   @IsNotEmpty()
   videoUrl!: string;

   @ApiPropertyOptional({
      description: 'HLS / DASH streaming playback URL if processed',
      example: 'https://pub-50b1ab619efd4084959e011fe2e5a273.r2.dev/videos/video_1/master.m3u8',
   })
   @IsUrl()
   @IsOptional()
   playbackUrl?: string;

   @ApiProperty({
      description: 'Cover thumbnail image URL',
      example: 'https://pub-50b1ab619efd4084959e011fe2e5a273.r2.dev/thumbnails/video_1.jpg',
   })
   @IsUrl()
   @IsNotEmpty()
   thumbnailUrl!: string;

   @ApiPropertyOptional({
      description: 'BlurHash placeholder string for smooth image/video lazy loading',
      example: 'LEHV6nWB2yk8pyo0adR*.7kCMdnj',
   })
   @IsString()
   @IsOptional()
   blurHash?: string;

   @ApiProperty({
      description: 'Video duration in seconds',
      example: 45,
   })
   @IsInt()
   @Min(1)
   duration!: number;

   @ApiPropertyOptional({
      description: 'Video pixel width resolution',
      example: 1080,
   })
   @IsInt()
   @IsOptional()
   videoWidth?: number;

   @ApiPropertyOptional({
      description: 'Video pixel height resolution',
      example: 1920,
   })
   @IsInt()
   @IsOptional()
   videoHeight?: number;

   @ApiPropertyOptional({
      description: 'Post visibility setting',
      enum: POST_VISIBILITY,
      example: 'PUBLIC',
      default: 'PUBLIC',
   })
   @IsEnum(POST_VISIBILITY)
   @IsOptional()
   visibility?: PostVisibility = 'PUBLIC';

   @ApiPropertyOptional({
      description: 'Whether comments are enabled for this post',
      example: true,
      default: true,
   })
   @IsBoolean()
   @IsOptional()
   allowComments?: boolean = true;

   @ApiPropertyOptional({
      description: 'Whether duet / remix is enabled for this post',
      example: false,
      default: false,
   })
   @IsBoolean()
   @IsOptional()
   allowDuet?: boolean = false;

   @ApiPropertyOptional({
      description: 'List of hashtags (without # prefix)',
      example: ['monngon', 'healthy', 'nauan'],
   })
   @IsArray()
   @IsString({ each: true })
   @IsOptional()
   tags?: string[];

   @ApiPropertyOptional({
      description: 'List of mentioned user UUIDs tagged in this post',
      example: ['0192e21b-0002-7000-8000-000000000010'],
   })
   @IsArray()
   @IsUUID('4', { each: true })
   @IsOptional()
   mentionedUserIds?: string[];

   @ApiPropertyOptional({
      description: 'List of category UUIDs associated with this post',
      example: ['0192e21b-0002-7000-8000-000000000020'],
   })
   @IsArray()
   @IsUUID('4', { each: true })
   @IsOptional()
   categoryIds?: string[];

   @ApiPropertyOptional({
      description: 'Quick-access dish ingredients list',
      type: [CreatePostIngredientDto],
   })
   @IsArray()
   @ValidateNested({ each: true })
   @Type(() => CreatePostIngredientDto)
   @IsOptional()
   ingredients?: CreatePostIngredientDto[];

   @ApiPropertyOptional({
      description: 'Detailed recipe instructions with steps and timings',
      type: CreateRecipeDto,
   })
   @ValidateNested()
   @Type(() => CreateRecipeDto)
   @IsOptional()
   recipe?: CreateRecipeDto;
}
