import type { Observable } from 'rxjs';
import type { Metadata } from '@grpc/grpc-js';
import type {
   IGetIngredientsByPostIdRequest,
   IGetIngredientsByPostIdResponse,
   IGetPostByIdRequest,
   IGetPostByIdResponse,
   IGetPostFeedRequest,
   IGetPostFeedResponse,
} from '@contracts/post/grpc/v1/messages';

export interface IPostV1GrpcService {
   getFeed(request: IGetPostFeedRequest, metadata?: Metadata): Observable<IGetPostFeedResponse>;
   getPostById(request: IGetPostByIdRequest, metadata?: Metadata): Observable<IGetPostByIdResponse>;
   getIngredientsByPostId(
      request: IGetIngredientsByPostIdRequest,
      metadata?: Metadata,
   ): Observable<IGetIngredientsByPostIdResponse>;
}

export type IPostGrpcService = IPostV1GrpcService;
