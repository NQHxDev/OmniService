import { Controller, UseFilters, UseInterceptors } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { from, type Observable } from 'rxjs';
import { GrpcExceptionFilter, GrpcLoggingInterceptor, GrpcMetricsInterceptor } from '@common';
import {
   POST_V1_GRPC_METHODS,
   POST_V1_GRPC_SERVICE_NAME,
   type CreatePostDto,
   type GetPostFeedDto,
   type ICreatePostRequest,
   type ICreatePostResponse,
   type IGetIngredientsByPostIdRequest,
   type IGetIngredientsByPostIdResponse,
   type IGetPostByIdRequest,
   type IGetPostByIdResponse,
   type IGetPostFeedRequest,
   type IGetPostFeedResponse,
   type IPostIngredientProto,
   type IPostItemProto,
   type IPostV1GrpcService,
   type IRecipeProto,
   type PostIngredientDto,
   type PostItemDto,
   type PostVisibility,
   type RecipeDifficulty,
   type RecipeDto,
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

   private mapRecipeDtoToProto(recipe?: RecipeDto | null): IRecipeProto | undefined {
      if (!recipe) return undefined;
      return {
         recipeId: recipe.recipeId,
         prepTimeMinutes: recipe.prepTimeMinutes,
         cookTimeMinutes: recipe.cookTimeMinutes,
         servings: recipe.servings,
         difficulty: recipe.difficulty,
         calories: recipe.calories !== null && recipe.calories !== undefined ? recipe.calories : undefined,
         cuisine: recipe.cuisine || undefined,
         chefTips: recipe.chefTips || undefined,
         steps: (recipe.steps || []).map((step) => ({
            stepId: step.stepId,
            stepNumber: step.stepNumber,
            title: step.title || undefined,
            instruction: step.instruction,
            timestampSeconds:
               step.timestampSeconds !== null && step.timestampSeconds !== undefined
                  ? step.timestampSeconds
                  : undefined,
            imageUrl: step.imageUrl || undefined,
            mediaId: step.mediaId || undefined,
         })),
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
         recipe: this.mapRecipeDtoToProto(item.recipe),
         tags: item.tags || [],
         mentionedUserIds: item.mentionedUserIds || [],
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

   @GrpcMethod(POST_V1_GRPC_SERVICE_NAME, POST_V1_GRPC_METHODS.CREATE_POST)
   createPost(data: ICreatePostRequest): Observable<ICreatePostResponse> {
      const dto: CreatePostDto = {
         title: data.title,
         caption: data.caption,
         mediaId: data.mediaId,
         videoUrl: data.videoUrl,
         playbackUrl: data.playbackUrl,
         thumbnailUrl: data.thumbnailUrl,
         blurHash: data.blurHash,
         duration: data.duration,
         videoWidth: data.videoWidth,
         videoHeight: data.videoHeight,
         visibility: data.visibility as PostVisibility,
         allowComments: data.allowComments,
         allowDuet: data.allowDuet,
         tags: data.tags,
         mentionedUserIds: data.mentionedUserIds,
         categoryIds: data.categoryIds,
         ingredients: (data.ingredients || []).map((ing) => ({
            name: ing.name,
            amount: ing.amount,
            unit: ing.unit,
            group: ing.group,
            sortOrder: ing.sortOrder,
            catalogIngredientId: ing.catalogIngredientId,
         })),
         recipe: data.recipe
            ? {
                 prepTimeMinutes: data.recipe.prepTimeMinutes,
                 cookTimeMinutes: data.recipe.cookTimeMinutes,
                 servings: data.recipe.servings,
                 difficulty: data.recipe.difficulty as RecipeDifficulty,
                 calories: data.recipe.calories,
                 cuisine: data.recipe.cuisine,
                 chefTips: data.recipe.chefTips,
                 steps: (data.recipe.steps || []).map((step) => ({
                    stepNumber: step.stepNumber,
                    title: step.title,
                    instruction: step.instruction,
                    timestampSeconds: step.timestampSeconds,
                    imageUrl: step.imageUrl,
                    mediaId: step.mediaId,
                 })),
              }
            : undefined,
      };

      return from(
         this.postService.createPost(data.userId, dto).then((post) => ({
            post: this.mapPostDtoToProto(post),
         })),
      );
   }
}
