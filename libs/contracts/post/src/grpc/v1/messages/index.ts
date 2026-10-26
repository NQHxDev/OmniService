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
