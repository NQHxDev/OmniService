import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PostAuthorDto } from '@contracts/post/dto/post-author.dto';
import { PostIngredientDto } from '@contracts/post/dto/post-ingredient.dto';
import { RecipeDto } from '@contracts/post/dto/recipe.dto';

export class PostItemDto {
   @ApiProperty({
      description: 'Unique identifier of the post',
      example: 'a0b1c2d3-e4f5-6789-0123-abcdef456789',
   })
   postId!: string;

   @ApiProperty({
      description: 'Identifier of user author who created the post',
      example: 'user-1234-uuid',
   })
   userId!: string;

   @ApiPropertyOptional({
      description: 'Author profile summary (including display name) of the user who created the post',
      type: PostAuthorDto,
      nullable: true,
   })
   author?: PostAuthorDto | null;

   @ApiProperty({
      description: 'Title of recipe or post video',
      example: 'Authentic Beef Pho Tutorial',
   })
   title!: string;

   @ApiPropertyOptional({
      description: 'Caption or descriptive summary of the post',
      example: 'Learn how to make rich Vietnamese beef broth with toasted spices in 30 minutes!',
      nullable: true,
   })
   caption?: string | null;

   @ApiPropertyOptional({
      description: 'Associated media asset identifier from Media Service',
      example: 'media-video-uuid-1',
      nullable: true,
   })
   mediaId?: string | null;

   @ApiProperty({
      description: 'Direct video playback URL (hosted on Cloudflare R2)',
      example: 'https://pub-50b1ab619efd4084959e011fe2e5a273.r2.dev/videos/video_1.mp4',
   })
   videoUrl!: string;

   @ApiPropertyOptional({
      description: 'HLS / DASH streaming playback URL if processed',
      example: 'https://pub-50b1ab619efd4084959e011fe2e5a273.r2.dev/videos/video_1/index.m3u8',
      nullable: true,
   })
   playbackUrl?: string | null;

   @ApiProperty({
      description: 'Cover thumbnail image URL',
      example: 'https://pub-50b1ab619efd4084959e011fe2e5a273.r2.dev/thumbnails/video_1.jpg',
   })
   thumbnailUrl!: string;

   @ApiPropertyOptional({
      description: 'BlurHash placeholder string for smooth image/video lazy loading',
      example: 'LEHV6nWB2yk8pyo0adR*.7kCMdnj',
      nullable: true,
   })
   blurHash?: string | null;

   @ApiProperty({
      description: 'Video duration in seconds',
      example: 45,
   })
   duration!: number;

   @ApiPropertyOptional({
      description: 'Video pixel width resolution',
      example: 1080,
      nullable: true,
   })
   videoWidth?: number | null;

   @ApiPropertyOptional({
      description: 'Video pixel height resolution',
      example: 1920,
      nullable: true,
   })
   videoHeight?: number | null;

   @ApiProperty({
      description: 'Total number of video views',
      example: 1540,
   })
   viewCount!: number;

   @ApiProperty({
      description: 'Total number of likes received',
      example: 320,
   })
   likeCount!: number;

   @ApiProperty({
      description: 'Total number of comments received',
      example: 28,
   })
   commentCount!: number;

   @ApiProperty({
      description: 'Total number of shares received',
      example: 12,
   })
   shareCount!: number;

   @ApiProperty({
      description: 'Total number of recipe/post saves received',
      example: 85,
   })
   saveCount!: number;

   @ApiProperty({
      description: 'Whether comments are enabled for this post',
      example: true,
   })
   allowComments!: boolean;

   @ApiProperty({
      description: 'Whether duet / remix is enabled for this post',
      example: false,
   })
   allowDuet!: boolean;

   @ApiProperty({
      description: 'Post creation timestamp in ISO 8601 format',
      example: '2026-10-17T02:00:00.000Z',
   })
   createdAt!: Date;

   @ApiProperty({
      description: 'Post last update timestamp in ISO 8601 format',
      example: '2026-10-17T02:00:00.000Z',
   })
   updatedAt!: Date;

   @ApiProperty({
      description: 'List of ingredients required for the dish in this video post',
      type: [PostIngredientDto],
   })
   ingredients!: PostIngredientDto[];

   @ApiPropertyOptional({
      description: 'Detailed recipe instructions for cooking the dish',
      type: RecipeDto,
      nullable: true,
   })
   recipe?: RecipeDto | null;

   @ApiPropertyOptional({
      description: 'List of hashtags associated with this post',
      type: [String],
      example: ['phobo', 'monngon'],
   })
   tags?: string[];

   @ApiPropertyOptional({
      description: 'List of mentioned user UUIDs in this post',
      type: [String],
      example: ['0192e21b-0002-7000-8000-000000000010'],
   })
   mentionedUserIds?: string[];
}
