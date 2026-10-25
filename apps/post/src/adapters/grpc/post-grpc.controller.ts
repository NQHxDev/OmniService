import { Controller, UseFilters, UseInterceptors } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { from, type Observable } from 'rxjs';
import { GrpcExceptionFilter, GrpcLoggingInterceptor, GrpcMetricsInterceptor } from '@common';
import {
   POST_V1_GRPC_METHODS,
   POST_V1_GRPC_SERVICE_NAME,
   type GetPostFeedDto,
   type IGetIngredientsByPostIdRequest,
   type IGetIngredientsByPostIdResponse,
   type IGetPostByIdRequest,
   type IGetPostByIdResponse,
   type IGetPostFeedRequest,
   type IGetPostFeedResponse,
   type IPostIngredientProto,
   type IPostItemProto,
   type IPostV1GrpcService,
   type PostIngredientDto,
   type PostItemDto,
} from '@contracts/post';
import { PostService } from '@post/services';

@Controller()
@UseFilters(new GrpcExceptionFilter())
@UseInterceptors(GrpcLoggingInterceptor, GrpcMetricsInterceptor)
export class PostGrpcController implements IPostV1GrpcService {
   constructor(private readonly postService: PostService) {}

   private mapIngredientDtoToProto(ing: PostIngredientDto): IPostIngredientProto {
      return {
         ingredientId: ing.ingredientId,
         name: ing.name,
         amount: ing.amount !== null && ing.amount !== undefined ? Number(ing.amount) : undefined,
         unit: ing.unit || undefined,
         group: ing.group || undefined,
         sortOrder: ing.sortOrder,
         catalogIngredientId: ing.catalogIngredientId || undefined,
      };
   }

   private mapPostDtoToProto(item: PostItemDto): IPostItemProto {
      return {
         postId: item.postId,
         userId: item.userId,
         title: item.title,
         caption: item.caption || undefined,
         mediaId: item.mediaId || undefined,
         videoUrl: item.videoUrl,
         playbackUrl: item.playbackUrl || undefined,
         thumbnailUrl: item.thumbnailUrl,
         blurHash: item.blurHash || undefined,
         duration: item.duration,
         videoWidth: item.videoWidth || undefined,
         videoHeight: item.videoHeight || undefined,
         viewCount: item.viewCount,
         likeCount: item.likeCount,
         commentCount: item.commentCount,
         shareCount: item.shareCount,
         saveCount: item.saveCount,
         allowComments: item.allowComments,
         allowDuet: item.allowDuet,
         createdAt: item.createdAt instanceof Date ? item.createdAt.toISOString() : String(item.createdAt),
         updatedAt: item.updatedAt instanceof Date ? item.updatedAt.toISOString() : String(item.updatedAt),
         ingredients: (item.ingredients || []).map((ing) => this.mapIngredientDtoToProto(ing)),
      };
   }

   @GrpcMethod(POST_V1_GRPC_SERVICE_NAME, POST_V1_GRPC_METHODS.GET_FEED)
   getFeed(data: IGetPostFeedRequest): Observable<IGetPostFeedResponse> {
      const dto: GetPostFeedDto = {
         limit: data.limit,
         cursor: data.cursor,
         userId: data.userId,
         tag: data.tag,
         category: data.category,
      };

      return from(
         this.postService.getFeed(dto).then((result) => ({
            items: result.items.map((item) => this.mapPostDtoToProto(item)),
            nextCursor: result.nextCursor || undefined,
            hasMore: result.hasMore,
         })),
      );
   }

   @GrpcMethod(POST_V1_GRPC_SERVICE_NAME, POST_V1_GRPC_METHODS.GET_POST_BY_ID)
   getPostById(data: IGetPostByIdRequest): Observable<IGetPostByIdResponse> {
      return from(
         this.postService.getPostById(data.postId).then((post) => ({
            post: this.mapPostDtoToProto(post),
         })),
      );
   }

   @GrpcMethod(POST_V1_GRPC_SERVICE_NAME, POST_V1_GRPC_METHODS.GET_INGREDIENTS_BY_POST_ID)
   getIngredientsByPostId(data: IGetIngredientsByPostIdRequest): Observable<IGetIngredientsByPostIdResponse> {
      return from(
         this.postService.getIngredientsByPostId(data.postId).then((ingredients) => ({
            items: ingredients.map((ing) => this.mapIngredientDtoToProto(ing)),
         })),
      );
   }
}
