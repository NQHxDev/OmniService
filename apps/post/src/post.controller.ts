import { Controller } from '@nestjs/common';
import { Ctx, MessagePattern, Payload, RmqContext } from '@nestjs/microservices';
import { QUEUES, RmqService, type IServiceMessage } from '@common';
import {
   POST_PATTERNS,
   type CreatePostDto,
   type GetPostFeedDto,
   type PostFeedResponseDto,
   type PostIngredientDto,
   type PostItemDto,
} from '@contracts/post';
import { PostService } from '@post/services';

@Controller()
export class PostController {
   constructor(
      private readonly postService: PostService,
      private readonly rmqService: RmqService,
   ) {}

   @MessagePattern({ cmd: POST_PATTERNS.GET_FEED })
   async getFeed(
      @Payload() payload: IServiceMessage<GetPostFeedDto> | GetPostFeedDto,
      @Ctx() context: RmqContext,
   ): Promise<PostFeedResponseDto> {
      try {
         const dto =
            payload && typeof payload === 'object' && 'data' in payload && payload.data
               ? payload.data
               : (payload as GetPostFeedDto);

         const result = await this.postService.getFeed(dto || {});
         this.rmqService.ack(context);
         return result;
      } catch (error) {
         await this.rmqService.handleError(error, context, { queue: QUEUES.POST });
         throw error;
      }
   }

   @MessagePattern({ cmd: POST_PATTERNS.GET_BY_ID })
   async getPostById(
      @Payload() payload: { postId: string } | IServiceMessage<{ postId: string }>,
      @Ctx() context: RmqContext,
   ): Promise<PostItemDto> {
      try {
         const data =
            payload && typeof payload === 'object' && 'data' in payload && payload.data
               ? payload.data
               : (payload as { postId: string });

         const result = await this.postService.getPostById(data.postId);
         this.rmqService.ack(context);
         return result;
      } catch (error) {
         await this.rmqService.handleError(error, context, { queue: QUEUES.POST });
         throw error;
      }
   }

   @MessagePattern({ cmd: POST_PATTERNS.GET_INGREDIENTS })
   async getIngredients(
      @Payload() payload: { postId: string } | IServiceMessage<{ postId: string }>,
      @Ctx() context: RmqContext,
   ): Promise<PostIngredientDto[]> {
      try {
         const data =
            payload && typeof payload === 'object' && 'data' in payload && payload.data
               ? payload.data
               : (payload as { postId: string });

         const result = await this.postService.getIngredientsByPostId(data.postId);
         this.rmqService.ack(context);
         return result;
      } catch (error) {
         await this.rmqService.handleError(error, context, { queue: QUEUES.POST });
         throw error;
      }
   }

   @MessagePattern({ cmd: POST_PATTERNS.CREATE })
   async createPost(
      @Payload()
      payload: { userId: string; dto: CreatePostDto } | IServiceMessage<{ userId: string; dto: CreatePostDto }>,
      @Ctx() context: RmqContext,
   ): Promise<PostItemDto> {
      try {
         const data =
            payload && typeof payload === 'object' && 'data' in payload && payload.data
               ? payload.data
               : (payload as { userId: string; dto: CreatePostDto });

         const result = await this.postService.createPost(data.userId, data.dto);
         this.rmqService.ack(context);
         return result;
      } catch (error) {
         await this.rmqService.handleError(error, context, { queue: QUEUES.POST });
         throw error;
      }
   }
}
