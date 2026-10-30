import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { defer, firstValueFrom } from 'rxjs';
import {
   BulkheadRegistry,
   CircuitBreakerRegistry,
   handleGrpcError,
   RedisService,
   RetryPolicyRegistry,
   withGrpcRetry,
} from '@common';
import {
   POST_CACHE_KEYS,
   POST_CACHE_TTL,
   POST_V1_GRPC_CLIENT,
   POST_V1_GRPC_SERVICE_NAME,
   type CreatePostDto,
   type GetPostFeedDto,
   type IPostItemProto,
   type IPostV1GrpcService,
   type PostAuthorDto,
   type PostFeedResponseDto,
   type PostIngredientDto,
   type PostItemDto,
} from '@contracts/post';
import { USER_V1_GRPC_CLIENT, USER_V1_GRPC_SERVICE_NAME, type IUserV1GrpcService } from '@contracts/user';
import {
   SEARCH_V1_GRPC_CLIENT,
   SEARCH_V1_GRPC_SERVICE_NAME,
   type IPostSearchHitProto,
   type ISearchV1GrpcService,
} from '@contracts/search';

@Injectable()
export class PostsService implements OnModuleInit {
   private readonly logger = new Logger(PostsService.name);
   private searchGrpcService!: ISearchV1GrpcService;
   private postGrpcService!: IPostV1GrpcService;
   private userGrpcService!: IUserV1GrpcService;

   private readonly searchBulkhead = BulkheadRegistry.getOrCreate(SEARCH_V1_GRPC_SERVICE_NAME, {
      maxConcurrent: 50,
      maxQueueCapacity: 100,
   });

   private readonly searchGrpcBreaker = CircuitBreakerRegistry.getOrCreate(SEARCH_V1_GRPC_SERVICE_NAME, {
      timeout: 5000,
      failureThreshold: 5,
      resetTimeout: 10000,
   });

   private readonly searchGrpcRetryPolicy = RetryPolicyRegistry.getOrCreate(SEARCH_V1_GRPC_SERVICE_NAME, {
      maxAttempts: 3,
      initialDelayMs: 100,
      multiplier: 2,
      maxDelayMs: 2000,
   });

   private readonly userGrpcBreaker = CircuitBreakerRegistry.getOrCreate(USER_V1_GRPC_SERVICE_NAME, {
      timeout: 3000,
      failureThreshold: 5,
      resetTimeout: 10000,
   });

   private readonly postBulkhead = BulkheadRegistry.getOrCreate(POST_V1_GRPC_SERVICE_NAME, {
      maxConcurrent: 50,
      maxQueueCapacity: 100,
   });

   private readonly postGrpcBreaker = CircuitBreakerRegistry.getOrCreate(POST_V1_GRPC_SERVICE_NAME, {
      timeout: 5000,
      failureThreshold: 5,
      resetTimeout: 10000,
   });

   private readonly postGrpcRetryPolicy = RetryPolicyRegistry.getOrCreate(POST_V1_GRPC_SERVICE_NAME, {
      maxAttempts: 3,
      initialDelayMs: 100,
      multiplier: 2,
      maxDelayMs: 2000,
   });

   constructor(
      @Inject(SEARCH_V1_GRPC_CLIENT)
      private readonly searchGrpcClient: ClientGrpc,
      @Inject(POST_V1_GRPC_CLIENT)
      private readonly postGrpcClient: ClientGrpc,
      @Inject(USER_V1_GRPC_CLIENT)
      private readonly userGrpcClient: ClientGrpc,
      private readonly redisService: RedisService,
   ) {}

   onModuleInit(): void {
      this.searchGrpcService = this.searchGrpcClient.getService<ISearchV1GrpcService>(SEARCH_V1_GRPC_SERVICE_NAME);
      this.postGrpcService = this.postGrpcClient.getService<IPostV1GrpcService>(POST_V1_GRPC_SERVICE_NAME);
      this.userGrpcService = this.userGrpcClient.getService<IUserV1GrpcService>(USER_V1_GRPC_SERVICE_NAME);
   }

   /**
    * Single-hop Feed retrieval delegating directly to CQRS Read-Model (apps/search) via gRPC.
    * Combines Elasticsearch indexing + Redis dynamic counters in one hop, with resilience fallbacks.
    */
   async getFeed(query: GetPostFeedDto, _currentUserId?: string): Promise<PostFeedResponseDto> {
      try {
         const res = await this.searchBulkhead.execute(() =>
            this.searchGrpcBreaker.execute(() =>
               firstValueFrom(
                  defer(() =>
                     this.searchGrpcService.getPostFeed({
                        limit: query.limit ? Number(query.limit) : undefined,
                        cursor: query.cursor,
                        userId: query.userId,
                        tag: query.tag,
                        category: query.category,
                     }),
                  ).pipe(withGrpcRetry(this.searchGrpcRetryPolicy)),
               ),
            ),
         );

         const items = await this.enrichAuthors((res.items || []).map((hit) => this.mapSearchProtoToPostDto(hit)));

         return {
            items,
            nextCursor: res.nextCursor || null,
            hasMore: res.hasMore,
         };
      } catch (error) {
         this.logger.warn(
            `Search gRPC getFeed failed or circuit open, falling back to Post microservice: ${(error as Error).message}`,
         );
         return this.fetchFeedFromPostService(query);
      }
   }

   /**
    * Single-hop Post Detail retrieval.
    * Implements Read-Your-Own-Writes consistency check and Redis Read-Through caching.
    */
   async getPostById(postId: string, currentUserId?: string, bypassReadModel = false): Promise<PostItemDto> {
      // 1. Read-Your-Own-Writes Consistency check
      if (bypassReadModel) {
         this.logger.debug(`Bypassing Read Model for post ${postId} due to explicit bypass flag`);
         return this.fetchFromPostMaster(postId);
      }

      if (currentUserId) {
         const isRecentAuthor = await this.redisService.get(POST_CACHE_KEYS.recentAuthor(postId, currentUserId));
         if (isRecentAuthor) {
            this.logger.debug(
               `Bypassing Read Model for author ${currentUserId} viewing freshly published post ${postId}`,
            );
            return this.fetchFromPostMaster(postId);
         }
      }

      // 2. Redis Read-Through Cache
      const cacheKey = POST_CACHE_KEYS.detail(postId);
      const cached = await this.redisService.getJson<PostItemDto>(cacheKey);
      if (cached) {
         return {
            ...cached,
            createdAt: new Date(cached.createdAt),
            updatedAt: new Date(cached.updatedAt),
         };
      }

      // 3. Single gRPC hop to CQRS Read-Model (apps/search)
      try {
         const res = await this.searchBulkhead.execute(() =>
            this.searchGrpcBreaker.execute(() =>
               firstValueFrom(
                  defer(() => this.searchGrpcService.getPostDetail({ postId })).pipe(
                     withGrpcRetry(this.searchGrpcRetryPolicy),
                  ),
               ),
            ),
         );

         const [dto] = await this.enrichAuthors([this.mapSearchProtoToPostDto(res.post)]);

         // Write-Through to Redis Cache
         await this.redisService.setJson(cacheKey, dto, POST_CACHE_TTL.DETAIL_SECONDS);

         return dto;
      } catch (error) {
         this.logger.warn(
            `Search gRPC getPostDetail failed or circuit open for ${postId}, falling back to Master DB: ${(error as Error).message}`,
         );
         return this.fetchFromPostMaster(postId);
      }
   }

   async getIngredients(postId: string): Promise<PostIngredientDto[]> {
      try {
         const res = await this.postBulkhead.execute(() =>
            this.postGrpcBreaker.execute(() =>
               firstValueFrom(
                  defer(() => this.postGrpcService.getIngredientsByPostId({ postId })).pipe(
                     withGrpcRetry(this.postGrpcRetryPolicy),
                  ),
               ),
            ),
         );

         return (res.items || []).map((ing) => ({
            ingredientId: ing.ingredientId,
            name: ing.name,
            amount: ing.amount !== undefined ? ing.amount : null,
            unit: ing.unit || null,
            group: ing.group || null,
            sortOrder: ing.sortOrder,
            catalogIngredientId: ing.catalogIngredientId || null,
         }));
      } catch (error: unknown) {
         return handleGrpcError(error);
      }
   }

   /**
    * Helper for marking a freshly created post to guarantee Read-Your-Own-Writes consistency.
    */
   async markRecentPostCreation(
      postId: string,
      userId: string,
      ttlSeconds: number = POST_CACHE_TTL.RECENT_AUTHOR_SECONDS,
   ): Promise<void> {
      try {
         await this.redisService.set(POST_CACHE_KEYS.recentAuthor(postId, userId), '1', ttlSeconds);
      } catch (error) {
         this.logger.warn(`Failed to mark recent author write: ${(error as Error).message}`);
      }
   }

   async createPost(userId: string, dto: CreatePostDto): Promise<PostItemDto> {
      try {
         const res = await this.postBulkhead.execute(() =>
            this.postGrpcBreaker.execute(() =>
               firstValueFrom(
                  defer(() =>
                     this.postGrpcService.createPost({
                        userId,
                        title: dto.title,
                        caption: dto.caption,
                        mediaId: dto.mediaId,
                        videoUrl: dto.videoUrl,
                        playbackUrl: dto.playbackUrl,
                        thumbnailUrl: dto.thumbnailUrl,
                        blurHash: dto.blurHash,
                        duration: Math.round(dto.duration || 0),
                        videoWidth: dto.videoWidth !== undefined ? Math.round(dto.videoWidth) : undefined,
                        videoHeight: dto.videoHeight !== undefined ? Math.round(dto.videoHeight) : undefined,
                        visibility: dto.visibility,
                        allowComments: dto.allowComments,
                        allowDuet: dto.allowDuet,
                        tags: dto.tags,
                        mentionedUserIds: dto.mentionedUserIds,
                        categoryIds: dto.categoryIds,
                        ingredients: (dto.ingredients || []).map((ing, idx) => ({
                           name: ing.name,
                           amount: ing.amount !== undefined ? Number(ing.amount) : undefined,
                           unit: ing.unit,
                           group: ing.group,
                           sortOrder: ing.sortOrder ?? idx,
                           catalogIngredientId: ing.catalogIngredientId,
                        })),
                        recipe: dto.recipe
                           ? {
                                prepTimeMinutes: dto.recipe.prepTimeMinutes ?? 0,
                                cookTimeMinutes: dto.recipe.cookTimeMinutes ?? 0,
                                servings: dto.recipe.servings ?? 1,
                                difficulty: dto.recipe.difficulty || 'EASY',
                                calories: dto.recipe.calories,
                                cuisine: dto.recipe.cuisine,
                                chefTips: dto.recipe.chefTips,
                                steps: (dto.recipe.steps || []).map((step, sIdx) => ({
                                   stepNumber: step.stepNumber ?? sIdx + 1,
                                   title: step.title,
                                   instruction: step.instruction,
                                   timestampSeconds: step.timestampSeconds,
                                   imageUrl: step.imageUrl,
                                   mediaId: step.mediaId,
                                })),
                             }
                           : undefined,
                     }),
                  ).pipe(withGrpcRetry(this.postGrpcRetryPolicy)),
               ),
            ),
         );

         const [createdPost] = await this.enrichAuthors([this.mapPostProtoToDto(res.post)]);

         // Mark recent author write for Read-Your-Own-Writes consistency
         await this.markRecentPostCreation(createdPost.postId, userId);

         return createdPost;
      } catch (error: unknown) {
         return handleGrpcError(error);
      }
   }

   private async fetchFeedFromPostService(query: GetPostFeedDto): Promise<PostFeedResponseDto> {
      try {
         const res = await this.postBulkhead.execute(() =>
            this.postGrpcBreaker.execute(() =>
               firstValueFrom(
                  defer(() =>
                     this.postGrpcService.getFeed({
                        limit: query.limit ? Number(query.limit) : undefined,
                        cursor: query.cursor,
                        userId: query.userId,
                        tag: query.tag,
                        category: query.category,
                     }),
                  ).pipe(withGrpcRetry(this.postGrpcRetryPolicy)),
               ),
            ),
         );

         const items = await this.enrichAuthors((res.items || []).map((item) => this.mapPostProtoToDto(item)));

         return {
            items,
            nextCursor: res.nextCursor || null,
            hasMore: res.hasMore,
         };
      } catch (error: unknown) {
         return handleGrpcError(error);
      }
   }

   private async fetchFromPostMaster(postId: string): Promise<PostItemDto> {
      try {
         const res = await this.postBulkhead.execute(() =>
            this.postGrpcBreaker.execute(() =>
               firstValueFrom(
                  defer(() => this.postGrpcService.getPostById({ postId })).pipe(
                     withGrpcRetry(this.postGrpcRetryPolicy),
                  ),
               ),
            ),
         );

         const [dto] = await this.enrichAuthors([this.mapPostProtoToDto(res.post)]);
         return dto;
      } catch (error: unknown) {
         return handleGrpcError(error);
      }
   }

   /**
    * Fills missing author display names (and avatars) so clients receive the author's name
    * together with each post. Uses a Redis cache and degrades gracefully if User service is down.
    */
   private async enrichAuthors(items: PostItemDto[]): Promise<PostItemDto[]> {
      const missingUserIds = [...new Set(items.filter((item) => !item.author?.displayName).map((item) => item.userId))];
      if (missingUserIds.length === 0) {
         return items;
      }

      const authors = new Map<string, PostAuthorDto>();
      await Promise.all(
         missingUserIds.map(async (userId) => {
            const author = await this.resolveAuthor(userId);
            if (author) {
               authors.set(userId, author);
            }
         }),
      );

      return items.map((item) => {
         const resolved = authors.get(item.userId);
         return resolved ? { ...item, author: resolved } : item;
      });
   }

   private async resolveAuthor(userId: string): Promise<PostAuthorDto | null> {
      const cacheKey = POST_CACHE_KEYS.author(userId);
      try {
         const cached = await this.redisService.getJson<PostAuthorDto>(cacheKey);
         if (cached?.displayName) {
            return cached;
         }
      } catch (error) {
         this.logger.warn(`Failed to read author cache for ${userId}: ${(error as Error).message}`);
      }

      try {
         const res = await this.userGrpcBreaker.execute(() =>
            firstValueFrom(defer(() => this.userGrpcService.getUserById({ userId }))),
         );
         const displayName = res.user?.displayName || res.user?.profile?.displayName || null;
         if (!displayName) {
            return null;
         }
         const author: PostAuthorDto = {
            userId,
            displayName,
            avatarUrl: res.user?.avatar || res.user?.profile?.avatar || null,
         };
         await this.redisService.setJson(cacheKey, author, POST_CACHE_TTL.AUTHOR_SECONDS);
         return author;
      } catch (error) {
         this.logger.warn(`Failed to resolve author ${userId}: ${(error as Error).message}`);
         return null;
      }
   }

   private mapPostProtoToDto(item: IPostItemProto): PostItemDto {
      return {
         postId: item.postId,
         userId: item.userId,
         author: { userId: item.userId, displayName: null, avatarUrl: null },
         title: item.title,
         caption: item.caption || null,
         mediaId: item.mediaId || null,
         videoUrl: item.videoUrl,
         playbackUrl: item.playbackUrl || null,
         thumbnailUrl: item.thumbnailUrl,
         blurHash: item.blurHash || null,
         duration: item.duration,
         videoWidth: item.videoWidth || null,
         videoHeight: item.videoHeight || null,
         viewCount: item.viewCount,
         likeCount: item.likeCount,
         commentCount: item.commentCount,
         shareCount: item.shareCount,
         saveCount: item.saveCount,
         allowComments: item.allowComments,
         allowDuet: item.allowDuet,
         createdAt: new Date(item.createdAt),
         updatedAt: new Date(item.updatedAt),
         ingredients: (item.ingredients || []).map((ing) => ({
            ingredientId: ing.ingredientId,
            name: ing.name,
            amount: ing.amount !== undefined ? ing.amount : null,
            unit: ing.unit || null,
            group: ing.group || null,
            sortOrder: ing.sortOrder,
            catalogIngredientId: ing.catalogIngredientId || null,
         })),
         recipe: item.recipe
            ? {
                 recipeId: item.recipe.recipeId,
                 prepTimeMinutes: item.recipe.prepTimeMinutes,
                 cookTimeMinutes: item.recipe.cookTimeMinutes,
                 servings: item.recipe.servings,
                 difficulty: item.recipe.difficulty,
                 calories: item.recipe.calories !== undefined ? item.recipe.calories : null,
                 cuisine: item.recipe.cuisine || null,
                 chefTips: item.recipe.chefTips || null,
                 steps: (item.recipe.steps || []).map((step) => ({
                    stepId: step.stepId,
                    stepNumber: step.stepNumber,
                    title: step.title || null,
                    instruction: step.instruction,
                    timestampSeconds: step.timestampSeconds !== undefined ? step.timestampSeconds : null,
                    imageUrl: step.imageUrl || null,
                    mediaId: step.mediaId || null,
                 })),
              }
            : null,
         tags: item.tags || [],
         mentionedUserIds: item.mentionedUserIds || [],
      };
   }

   private mapSearchProtoToPostDto(hit: IPostSearchHitProto): PostItemDto {
      return {
         postId: hit.postId,
         userId: hit.userId,
         author: {
            userId: hit.author?.userId || hit.userId,
            displayName: hit.author?.displayName || null,
            avatarUrl: hit.author?.avatarUrl || null,
         },
         title: hit.title,
         caption: hit.caption || null,
         mediaId: hit.mediaId || null,
         videoUrl: hit.videoUrl,
         playbackUrl: hit.playbackUrl || null,
         thumbnailUrl: hit.thumbnailUrl,
         blurHash: hit.blurHash || null,
         duration: hit.duration,
         videoWidth: hit.videoWidth || null,
         videoHeight: hit.videoHeight || null,
         viewCount: hit.viewCount,
         likeCount: hit.likeCount,
         commentCount: hit.commentCount,
         shareCount: hit.shareCount,
         saveCount: hit.saveCount,
         allowComments: hit.allowComments,
         allowDuet: hit.allowDuet,
         createdAt: new Date(hit.createdAt),
         updatedAt: new Date(hit.updatedAt),
         ingredients: (hit.ingredients || []).map((ing) => ({
            ingredientId: ing.ingredientId,
            name: ing.name,
            amount: ing.amount,
            unit: ing.unit,
            group: ing.group || undefined,
            sortOrder: ing.sortOrder,
         })),
      };
   }
}
