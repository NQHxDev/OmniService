import type { Observable } from 'rxjs';
import type { Metadata } from '@grpc/grpc-js';

export interface IUserSearchHitProto {
   userId: string;
   documentId?: string;
   email?: string;
   username?: string;
   displayName?: string;
   avatar?: string;
   bio?: string;
   isVerified?: boolean;
   followersCount?: number;
   followingCount?: number;
   createdAt?: string;
   updatedAt?: string;
}

export interface IIngredientSearchHitProto {
   ingredientId: string;
   ingredientName: string;
   normalizedName: string;
   ingredientSlug: string;
   ingredientDescription: string;
   ingredientImageUrl: string;
   categoryId: string;
   categoryName: string;
   defaultUnit: string;
   ingredientStatus: string;
   supplierCount: number;
   minPrice: number;
   maxPrice: number;
   currency: string;
   createdAt: string;
   updatedAt: string;
}

export interface ISearchUsersRequest {
   query: string;
   limit?: number;
   cursor?: string;
}

export interface ISearchUsersResponse {
   items: IUserSearchHitProto[];
   nextCursor?: string;
   hasMore: boolean;
   total: number;
}

export interface ISearchIngredientsRequest {
   query?: string;
   categoryId?: string;
   limit?: number;
   offset?: number;
}

export interface ISearchIngredientsResponse {
   items: IIngredientSearchHitProto[];
   total: number;
   limit: number;
   offset: number;
}

export interface IProductVariantSearchProto {
   variantId: string;
   sku: string;
   variantName: string;
   unit: string;
   packSize?: string;
   price: number;
   originalPrice?: number;
   currency: string;
   stockQuantity: number;
   isDefault: boolean;
   status: string;
}

export interface IProductSearchHitProto {
   productId: string;
   supplierId: string;
   whoCategoryCode: string;
   productName: string;
   productSlug: string;
   description: string;
   origin?: string;
   images: string[];
   status: string;
   moderationStatus: string;
   variants: IProductVariantSearchProto[];
   minPrice?: number;
   maxPrice?: number;
   currency?: string;
   createdAt: string;
   updatedAt: string;
}

export interface IProductSuggestionProto {
   productId: string;
   productName: string;
   productSlug: string;
   whoCategoryCode: string;
   origin?: string;
   images: string[];
   defaultUnit?: string;
   minPrice?: number;
   maxPrice?: number;
   currency?: string;
}

export interface ISearchProductsRequest {
   query?: string;
   whoCategoryCode?: string;
   supplierId?: string;
   status?: string;
   limit?: number;
   offset?: number;
}

export interface ISearchProductsResponse {
   items: IProductSearchHitProto[];
   total: number;
   limit: number;
   offset: number;
}

export interface ISuggestProductsRequest {
   query: string;
   limit?: number;
}

export interface ISuggestProductsResponse {
   items: IProductSuggestionProto[];
}

export interface IGlobalSearchRequest {
   query: string;
   limit?: number;
   type?: string;
}

export interface IGlobalSearchResponse {
   users: IUserSearchHitProto[];
   ingredients: IIngredientSearchHitProto[];
   total: number;
}

export interface IPostAuthorProto {
   userId: string;
   displayName?: string;
   avatarUrl?: string;
   isVerified?: boolean;
   followerCount?: number;
}

export interface IPostShopProto {
   shopId: string;
   shopName?: string;
   logoUrl?: string;
}

export interface IPostSearchIngredientProto {
   ingredientId: string;
   name: string;
   amount: number;
   unit: string;
   group?: string;
   sortOrder: number;
}

export interface IPostSearchHitProto {
   postId: string;
   userId: string;
   title: string;
   caption?: string;
   mediaId?: string;
   videoUrl: string;
   playbackUrl?: string;
   thumbnailUrl: string;
   blurHash?: string;
   duration: number;
   videoWidth?: number;
   videoHeight?: number;
   viewCount: number;
   likeCount: number;
   commentCount: number;
   shareCount: number;
   saveCount: number;
   allowComments: boolean;
   allowDuet: boolean;
   createdAt: string;
   updatedAt: string;
   author: IPostAuthorProto;
   shop?: IPostShopProto;
   ingredients: IPostSearchIngredientProto[];
   tags: string[];
   category?: string;
}

export interface IGetPostFeedRequest {
   limit?: number;
   cursor?: string;
   userId?: string;
   tag?: string;
   category?: string;
}

export interface IGetPostFeedResponse {
   items: IPostSearchHitProto[];
   nextCursor?: string;
   hasMore: boolean;
   total: number;
}

export interface IGetPostDetailRequest {
   postId: string;
}

export interface IGetPostDetailResponse {
   post: IPostSearchHitProto;
}

export interface ISearchV1GrpcService {
   searchUsers(request: ISearchUsersRequest, metadata?: Metadata): Observable<ISearchUsersResponse>;
   searchIngredients(request: ISearchIngredientsRequest, metadata?: Metadata): Observable<ISearchIngredientsResponse>;
   searchProducts(request: ISearchProductsRequest, metadata?: Metadata): Observable<ISearchProductsResponse>;
   suggestProducts(request: ISuggestProductsRequest, metadata?: Metadata): Observable<ISuggestProductsResponse>;
   globalSearch(request: IGlobalSearchRequest, metadata?: Metadata): Observable<IGlobalSearchResponse>;
   getPostFeed(request: IGetPostFeedRequest, metadata?: Metadata): Observable<IGetPostFeedResponse>;
   getPostDetail(request: IGetPostDetailRequest, metadata?: Metadata): Observable<IGetPostDetailResponse>;
}

export type ISearchGrpcService = ISearchV1GrpcService;
