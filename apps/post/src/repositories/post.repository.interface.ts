import { PostEntity, PostIngredientEntity } from '@post/entities';
import type { CreatePostDto } from '@contracts/post';

export interface IPostCursorData {
   createdAt: Date;
   postId: string;
}

export interface IFindFeedParams {
   cursor?: IPostCursorData;
   limit: number;
   userId?: string;
   tag?: string;
   category?: string;
}

export interface IFeedQueryResult {
   items: PostEntity[];
   nextCursor: IPostCursorData | null;
   hasMore: boolean;
}

export const POST_REPOSITORY_TOKEN = Symbol('IPostRepository');

export interface IPostRepository {
   findFeed(params: IFindFeedParams): Promise<IFeedQueryResult>;
   findById(postId: string): Promise<PostEntity | null>;
   findIngredientsByPostId(postId: string): Promise<PostIngredientEntity[]>;
   create(userId: string, data: CreatePostDto): Promise<PostEntity>;
}
