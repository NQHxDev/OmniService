import type { IPostIngredientProto, IPostItemProto } from '@contracts/post/grpc/v1/models';

export interface IGetPostFeedRequest {
   limit?: number;
   cursor?: string;
   userId?: string;
   tag?: string;
   category?: string;
}

export interface IGetPostFeedResponse {
   items: IPostItemProto[];
   nextCursor?: string | null;
   hasMore: boolean;
}

export interface IGetPostByIdRequest {
   postId: string;
}

export interface IGetPostByIdResponse {
   post: IPostItemProto;
}

export interface IGetIngredientsByPostIdRequest {
   postId: string;
}

export interface IGetIngredientsByPostIdResponse {
   items: IPostIngredientProto[];
}

export interface ICreatePostIngredientInputProto {
   name: string;
   amount?: number;
   unit?: string;
   group?: string;
   sortOrder: number;
   catalogIngredientId?: string;
}

export interface ICreateRecipeStepInputProto {
   stepNumber: number;
   title?: string;
   instruction: string;
   timestampSeconds?: number;
   imageUrl?: string;
   mediaId?: string;
}

export interface ICreateRecipeInputProto {
   prepTimeMinutes: number;
   cookTimeMinutes: number;
   servings: number;
   difficulty: string;
   calories?: number;
   cuisine?: string;
   chefTips?: string;
   steps?: ICreateRecipeStepInputProto[];
}

export interface ICreatePostRequest {
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
   visibility?: string;
   allowComments?: boolean;
   allowDuet?: boolean;
   tags?: string[];
   mentionedUserIds?: string[];
   categoryIds?: string[];
   ingredients?: ICreatePostIngredientInputProto[];
   recipe?: ICreateRecipeInputProto;
}

export interface ICreatePostResponse {
   post: IPostItemProto;
}
