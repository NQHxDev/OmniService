import { Controller, UseFilters, UseInterceptors } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import type { Metadata } from '@grpc/grpc-js';
import { from, type Observable } from 'rxjs';
import { GrpcExceptionFilter, GrpcLoggingInterceptor, GrpcMetricsInterceptor, NotFoundException } from '@common';
import { POST_ERROR_CODES } from '@contracts/post';
import {
   SEARCH_V1_GRPC_METHODS,
   SEARCH_V1_GRPC_SERVICE_NAME,
   type IGetPostDetailRequest,
   type IGetPostDetailResponse,
   type IGetPostFeedRequest,
   type IGetPostFeedResponse,
   type IGlobalSearchRequest,
   type IGlobalSearchResponse,
   type IIngredientSearchHitProto,
   type IPostSearchHitProto,
   type ISearchIngredientsRequest,
   type ISearchIngredientsResponse,
   type ISearchUsersRequest,
   type ISearchUsersResponse,
   type ISearchV1GrpcService,
   type IUserSearchHitProto,
} from '@contracts/search';
import { UserSearchService, type UserDocument } from '@search/domains/user-search/user-search.service';
import {
   IngredientSearchService,
   type IngredientDocument,
} from '@search/domains/ingredient-search/ingredient-search.service';
import { PostSearchService, type HydratedPostHit } from '@search/domains/post-search/post-search.service';

/**
 * Inbound Adapter (Hexagonal Architecture) handling incoming gRPC requests for SearchService.
 * Multiplexed HTTP/2 high-throughput search queries.
 */
@Controller()
@UseFilters(new GrpcExceptionFilter())
@UseInterceptors(GrpcLoggingInterceptor, GrpcMetricsInterceptor)
export class SearchGrpcController implements ISearchV1GrpcService {
   constructor(
      private readonly userSearchService: UserSearchService,
      private readonly ingredientSearchService: IngredientSearchService,
      private readonly postSearchService: PostSearchService,
   ) {}

   private mapUserToProto(user: UserDocument): IUserSearchHitProto {
      return {
         userId: user.id,
         documentId: user.id,
         email: user.email ?? undefined,
         username: user.username ?? undefined,
         displayName: user.displayName ?? undefined,
         avatar: user.avatar ?? undefined,
         bio: user.bio ?? undefined,
         isVerified: user.isVerified ?? undefined,
         followersCount: user.followersCount ?? undefined,
         followingCount: user.followingCount ?? undefined,
         createdAt:
            user.createdAt instanceof Date
               ? user.createdAt.toISOString()
               : user.createdAt
                 ? String(user.createdAt)
                 : undefined,
         updatedAt:
            user.updatedAt instanceof Date
               ? user.updatedAt.toISOString()
               : user.updatedAt
                 ? String(user.updatedAt)
                 : undefined,
      };
   }

   private mapIngredientToProto(doc: IngredientDocument): IIngredientSearchHitProto {
      return {
         ingredientId: doc.ingredientId,
         ingredientName: doc.ingredientName,
         normalizedName: doc.normalizedName,
         ingredientSlug: doc.ingredientSlug,
         ingredientDescription: doc.ingredientDescription,
         ingredientImageUrl: doc.ingredientImageUrl,
         categoryId: doc.categoryId,
         categoryName: doc.categoryName,
         defaultUnit: doc.defaultUnit,
         ingredientStatus: doc.ingredientStatus,
         supplierCount: doc.supplierCount ?? 0,
         minPrice: doc.minPrice ?? 0,
         maxPrice: doc.maxPrice ?? 0,
         currency: doc.currency,
         createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : String(doc.createdAt),
         updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : String(doc.updatedAt),
      };
   }

   private mapPostToProto(doc: HydratedPostHit): IPostSearchHitProto {
      return {
         postId: doc.postId,
         userId: doc.userId,
         title: doc.title,
         caption: doc.caption ?? undefined,
         mediaId: doc.mediaId ?? undefined,
         videoUrl: doc.videoUrl,
         playbackUrl: doc.playbackUrl ?? undefined,
         thumbnailUrl: doc.thumbnailUrl,
         blurHash: doc.blurHash ?? undefined,
         duration: doc.duration,
         videoWidth: doc.videoWidth ?? undefined,
         videoHeight: doc.videoHeight ?? undefined,
         viewCount: doc.viewCount,
         likeCount: doc.likeCount,
         commentCount: doc.commentCount,
         shareCount: doc.shareCount,
         saveCount: doc.saveCount,
         allowComments: doc.allowComments,
         allowDuet: doc.allowDuet,
         createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : String(doc.createdAt),
         updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : String(doc.updatedAt),
         author: {
            userId: doc.author.userId,
            displayName: doc.author.displayName ?? undefined,
            avatarUrl: doc.author.avatarUrl ?? undefined,
            isVerified: doc.author.isVerified ?? false,
            followerCount: doc.author.followerCount ?? 0,
         },
         shop: doc.shop
            ? {
                 shopId: doc.shop.shopId,
                 shopName: doc.shop.shopName ?? undefined,
                 logoUrl: doc.shop.logoUrl ?? undefined,
              }
            : undefined,
         ingredients: (doc.ingredients || []).map((ing) => ({
            ingredientId: ing.ingredientId,
            name: ing.name,
            amount: ing.amount,
            unit: ing.unit,
            group: ing.group ?? undefined,
            sortOrder: ing.sortOrder,
         })),
         tags: doc.tags ?? [],
         category: doc.category ?? undefined,
      };
   }

   @GrpcMethod(SEARCH_V1_GRPC_SERVICE_NAME, SEARCH_V1_GRPC_METHODS.SEARCH_USERS)
   searchUsers(request: ISearchUsersRequest, _metadata?: Metadata): Observable<ISearchUsersResponse> {
      return from(
         this.userSearchService.searchUsers(request.query, request.limit, request.cursor).then((res) => ({
            items: res.items.map((item) => this.mapUserToProto(item)),
            nextCursor: res.nextCursor ?? undefined,
            hasMore: res.hasMore,
            total: res.total ?? res.items.length,
         })),
      );
   }

   @GrpcMethod(SEARCH_V1_GRPC_SERVICE_NAME, SEARCH_V1_GRPC_METHODS.SEARCH_INGREDIENTS)
   searchIngredients(request: ISearchIngredientsRequest, _metadata?: Metadata): Observable<ISearchIngredientsResponse> {
      return from(
         this.ingredientSearchService
            .searchIngredients({
               query: request.query,
               categoryId: request.categoryId,
               limit: request.limit,
               offset: request.offset,
            })
            .then((res) => ({
               items: res.items.map((item) => this.mapIngredientToProto(item)),
               total: res.total,
               limit: res.limit,
               offset: res.offset,
            })),
      );
   }

   @GrpcMethod(SEARCH_V1_GRPC_SERVICE_NAME, SEARCH_V1_GRPC_METHODS.GLOBAL_SEARCH)
   globalSearch(request: IGlobalSearchRequest, _metadata?: Metadata): Observable<IGlobalSearchResponse> {
      return from(
         Promise.all([
            this.userSearchService.searchUsers(request.query, request.limit),
            this.ingredientSearchService.searchIngredients({ query: request.query, limit: request.limit }),
         ]).then(([usersRes, ingredientsRes]) => ({
            users: usersRes.items.map((u) => this.mapUserToProto(u)),
            ingredients: ingredientsRes.items.map((i) => this.mapIngredientToProto(i)),
            total: (usersRes.total ?? usersRes.items.length) + ingredientsRes.total,
         })),
      );
   }

   @GrpcMethod(SEARCH_V1_GRPC_SERVICE_NAME, SEARCH_V1_GRPC_METHODS.GET_POST_FEED)
   getPostFeed(request: IGetPostFeedRequest, _metadata?: Metadata): Observable<IGetPostFeedResponse> {
      return from(
         this.postSearchService
            .getFeed({
               limit: request.limit,
               cursor: request.cursor,
               userId: request.userId,
               tag: request.tag,
               category: request.category,
            })
            .then((res) => ({
               items: res.items.map((item) => this.mapPostToProto(item)),
               nextCursor: res.nextCursor ?? undefined,
               hasMore: res.hasMore,
               total: res.total,
            })),
      );
   }

   @GrpcMethod(SEARCH_V1_GRPC_SERVICE_NAME, SEARCH_V1_GRPC_METHODS.GET_POST_DETAIL)
   getPostDetail(request: IGetPostDetailRequest, _metadata?: Metadata): Observable<IGetPostDetailResponse> {
      return from(
         this.postSearchService.getPostDetail(request.postId).then((post) => {
            if (!post) {
               throw new NotFoundException(POST_ERROR_CODES.POST_NOT_FOUND, {
                  params: { postId: request.postId },
               });
            }
            return {
               post: this.mapPostToProto(post),
            };
         }),
      );
   }
}
