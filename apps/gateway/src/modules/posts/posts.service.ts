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
   type GetPostFeedDto,
   type IPostItemProto,
   type IPostV1GrpcService,
   type PostFeedResponseDto,
   type PostIngredientDto,
   type PostItemDto,
} from '@contracts/post';
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
      private readonly redisService: RedisService,
   ) {}

   onModuleInit(): void {
      this.searchGrpcService = this.searchGrpcClient.getService<ISearchV1GrpcService>(SEARCH_V1_GRPC_SERVICE_NAME);
      this.postGrpcService = this.postGrpcClient.getService<IPostV1GrpcService>(POST_V1_GRPC_SERVICE_NAME);
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

         return {
            items: (res.items || []).map((hit) => this.mapSearchProtoToPostDto(hit)),
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

         const dto = this.mapSearchProtoToPostDto(res.post);

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

         return {
            items: (res.items || []).map((item) => this.mapPostProtoToDto(item)),
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

         return this.mapPostProtoToDto(res.post);
      } catch (error: unknown) {
         return handleGrpcError(error);
      }
   }

   private mapPostProtoToDto(item: IPostItemProto): PostItemDto {
      return {
         postId: item.postId,
         userId: item.userId,
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
      };
   }

   private mapSearchProtoToPostDto(hit: IPostSearchHitProto): PostItemDto {
      return {
         postId: hit.postId,
         userId: hit.userId,
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
