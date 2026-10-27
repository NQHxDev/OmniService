import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { BadRequestException, NotFoundException, SERVICES } from '@common';
import {
   POST_ERROR_CODES,
   POST_EVENT_KEYS,
   POST_EVENTS,
   type CreatePostDto,
   type GetPostFeedDto,
   type PostFeedResponseDto,
   type PostIngredientDto,
   type PostItemDto,
} from '@contracts/post';
import { POST_REPOSITORY_TOKEN, type IPostCursorData, type IPostRepository } from '@post/repositories';
import { PostEntity } from '@post/entities';

@Injectable()
export class PostService {
   private readonly logger = new Logger(PostService.name);

   constructor(
      @Inject(POST_REPOSITORY_TOKEN)
      private readonly postRepository: IPostRepository,
      @Optional()
      @Inject(SERVICES.SEARCH_SERVICE)
      private readonly searchClient?: ClientProxy,
      @Optional()
      @Inject(SERVICES.NOTIFICATION_SERVICE)
      private readonly notificationClient?: ClientProxy,
   ) {}

   async getFeed(dto: GetPostFeedDto): Promise<PostFeedResponseDto> {
      const limit = dto.limit ? Math.min(Math.max(Number(dto.limit), 1), 20) : 3;
      const decodedCursor = this.decodeCursor(dto.cursor);

      const result = await this.postRepository.findFeed({
         cursor: decodedCursor,
         limit,
         userId: dto.userId,
         tag: dto.tag,
         category: dto.category,
      });

      const nextCursorString = result.nextCursor ? this.encodeCursor(result.nextCursor) : null;

      return {
         items: result.items.map((item) => this.mapEntityToDto(item)),
         nextCursor: nextCursorString,
         hasMore: result.hasMore,
      };
   }

   async getPostById(postId: string): Promise<PostItemDto> {
      const post = await this.postRepository.findById(postId);
      if (!post) {
         throw new NotFoundException(POST_ERROR_CODES.POST_NOT_FOUND, {
            params: { postId },
         });
      }

      return this.mapEntityToDto(post);
   }

   async getIngredientsByPostId(postId: string): Promise<PostIngredientDto[]> {
      const post = await this.postRepository.findById(postId);
      if (!post) {
         throw new NotFoundException(POST_ERROR_CODES.POST_NOT_FOUND, {
            params: { postId },
         });
      }

      const ingredients = await this.postRepository.findIngredientsByPostId(postId);
      return ingredients.map((ing) => ({
         ingredientId: ing.ingredientId,
         name: ing.name,
         amount: ing.amount,
         unit: ing.unit,
         group: ing.group,
         sortOrder: ing.sortOrder,
         catalogIngredientId: ing.catalogIngredientId || undefined,
      }));
   }

   async createPost(userId: string, dto: CreatePostDto): Promise<PostItemDto> {
      if (!userId) {
         throw new BadRequestException(POST_ERROR_CODES.UNAUTHORIZED);
      }

      if (!dto.title || !dto.videoUrl || !dto.thumbnailUrl || !dto.duration) {
         throw new BadRequestException(POST_ERROR_CODES.CREATE_FAILED);
      }

      const entity = await this.postRepository.create(userId, dto);
      const postDto = this.mapEntityToDto(entity);

      // Publish post.created domain event to RabbitMQ for search indexing and notifications
      const eventPayload = {
         eventId: POST_EVENT_KEYS.buildCreatedEventId(entity.postId),
         idempotencyKey: POST_EVENT_KEYS.buildCreatedIdempotencyKey(entity.postId),
         postId: entity.postId,
         userId: entity.userId,
         title: entity.title,
         caption: entity.caption,
         mediaId: entity.mediaId,
         videoUrl: entity.videoUrl,
         playbackUrl: entity.playbackUrl,
         thumbnailUrl: entity.thumbnailUrl,
         blurHash: entity.blurHash,
         duration: entity.duration,
         videoWidth: entity.videoWidth,
         videoHeight: entity.videoHeight,
         allowComments: entity.allowComments,
         allowDuet: entity.allowDuet,
         createdAt: entity.createdAt,
         updatedAt: entity.updatedAt,
         author: {
            userId: entity.userId,
         },
         ingredients: postDto.ingredients,
         recipe: postDto.recipe,
         tags: postDto.tags,
         mentionedUserIds: postDto.mentionedUserIds,
         categoryIds: dto.categoryIds,
         likeCount: entity.likeCount,
         viewCount: entity.viewCount,
         commentCount: entity.commentCount,
         shareCount: entity.shareCount,
         saveCount: entity.saveCount,
      };

      try {
         if (this.searchClient) {
            this.searchClient.emit(POST_EVENTS.CREATED, eventPayload);
         }
         if (this.notificationClient) {
            this.notificationClient.emit(POST_EVENTS.CREATED, eventPayload);
         }
         this.logger.log(`Published ${POST_EVENTS.CREATED} event for post ${entity.postId}`);
      } catch (err) {
         this.logger.error(`Failed to emit post.created event: ${(err as Error).message}`);
      }

      return postDto;
   }

   private decodeCursor(cursor?: string): IPostCursorData | undefined {
      if (!cursor) {
         return undefined;
      }

      try {
         const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
         const parsed = JSON.parse(decoded) as { createdAt?: string; postId?: string };

         if (!parsed.createdAt || !parsed.postId) {
            throw new Error('Missing cursor fields');
         }

         const date = new Date(parsed.createdAt);
         if (isNaN(date.getTime())) {
            throw new Error('Invalid cursor date');
         }

         return {
            createdAt: date,
            postId: parsed.postId,
         };
      } catch {
         throw new BadRequestException(POST_ERROR_CODES.INVALID_CURSOR);
      }
   }

   private encodeCursor(cursor: IPostCursorData): string {
      const payload = {
         createdAt: cursor.createdAt.toISOString(),
         postId: cursor.postId,
      };
      return Buffer.from(JSON.stringify(payload)).toString('base64');
   }

   private mapEntityToDto(entity: PostEntity): PostItemDto {
      return {
         postId: entity.postId,
         userId: entity.userId,
         title: entity.title,
         caption: entity.caption,
         mediaId: entity.mediaId,
         videoUrl: entity.videoUrl,
         playbackUrl: entity.playbackUrl,
         thumbnailUrl: entity.thumbnailUrl,
         blurHash: entity.blurHash,
         duration: entity.duration,
         videoWidth: entity.videoWidth,
         videoHeight: entity.videoHeight,
         viewCount: entity.viewCount,
         likeCount: entity.likeCount,
         commentCount: entity.commentCount,
         shareCount: entity.shareCount,
         saveCount: entity.saveCount,
         allowComments: entity.allowComments,
         allowDuet: entity.allowDuet,
         createdAt: entity.createdAt,
         updatedAt: entity.updatedAt,
         ingredients: (entity.ingredients || []).map((ing) => ({
            ingredientId: ing.ingredientId,
            name: ing.name,
            amount: ing.amount,
            unit: ing.unit,
            group: ing.group,
            sortOrder: ing.sortOrder,
            catalogIngredientId: ing.catalogIngredientId || undefined,
         })),
         recipe: entity.recipe
            ? {
                 recipeId: entity.recipe.recipeId,
                 prepTimeMinutes: entity.recipe.prepTimeMinutes,
                 cookTimeMinutes: entity.recipe.cookTimeMinutes,
                 servings: entity.recipe.servings,
                 difficulty: entity.recipe.difficulty,
                 calories: entity.recipe.calories,
                 cuisine: entity.recipe.cuisine,
                 chefTips: entity.recipe.chefTips,
                 steps: (entity.recipe.steps || []).map((step) => ({
                    stepId: step.stepId,
                    stepNumber: step.stepNumber,
                    title: step.title,
                    instruction: step.instruction,
                    timestampSeconds: step.timestampSeconds,
                    imageUrl: step.imageUrl,
                    mediaId: step.mediaId,
                 })),
              }
            : null,
         tags: entity.tags || [],
         mentionedUserIds: entity.mentionedUserIds || [],
      };
   }
}
