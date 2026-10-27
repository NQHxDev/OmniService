import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiErrorResponses, COMMON_ERROR_CODES, CurrentUser, type JwtPayload, Public, ResponseMessage } from '@common';
import {
   CreatePostDto,
   GetPostFeedDto,
   POST_ERROR_CODES,
   POST_RESPONSE_MESSAGES,
   PostFeedResponseDto,
   PostIngredientDto,
   PostItemDto,
} from '@contracts/post';
import { PostsService } from '@/modules/posts/posts.service';

@ApiTags('Posts')
@Controller('posts')
export class PostsController {
   constructor(private readonly postsService: PostsService) {}

   @Post()
   @HttpCode(HttpStatus.CREATED)
   @ApiBearerAuth()
   @ApiCookieAuth()
   @ApiOperation({
      operationId: 'createPost',
      summary: 'Publish a new video recipe post',
      description: `### Workflow: Video Recipe Post Publishing
#### Prerequisites
- Client must have uploaded the video and thumbnail via Media Service to acquire valid \`videoUrl\`, \`thumbnailUrl\`, and optional \`mediaId\`.

#### Process Flow
- Validates the post content, ingredients list, and optional step-by-step cooking recipe.
- Atomically creates the post, ingredients, recipe steps, tags, and user mentions in a database transaction.
- Automatically extracts hashtags from the caption and registers them into trending tags.
- Emits \`post.created\` domain event across RabbitMQ to index into Elasticsearch and dispatch notifications to mentioned users.
- Marks creator author key in Redis for Read-Your-Own-Writes consistency.

#### Next Step
- Call \`GET /api/v1/posts/:postId\` to inspect the newly published post with immediate consistency.`,
   })
   @ApiResponse({
      status: HttpStatus.CREATED,
      description: 'Post published successfully.',
      type: PostItemDto,
      links: {
         GetPostById: {
            operationId: 'getPostById',
            description: 'Fetch the newly created post by its ID',
            parameters: {
               postId: '$response.body#/data/postId',
            },
         },
      },
   })
   @ApiErrorResponses([
      {
         status: HttpStatus.BAD_REQUEST,
         description: 'Invalid post creation payload or missing mandatory parameters',
         errorCodes: [POST_ERROR_CODES.CREATE_FAILED, COMMON_ERROR_CODES.INVALID_REQUEST],
      },
      {
         status: HttpStatus.UNAUTHORIZED,
         description: 'User authentication required',
         errorCodes: [COMMON_ERROR_CODES.UNAUTHORIZED],
      },
   ])
   @ResponseMessage(POST_RESPONSE_MESSAGES.CREATE_POST_SUCCESS)
   async createPost(@Body() dto: CreatePostDto, @CurrentUser() user: JwtPayload): Promise<PostItemDto> {
      return this.postsService.createPost(user.sub, dto);
   }

   @Get('feed')
   @Public()
   @HttpCode(HttpStatus.OK)
   @ApiOperation({
      operationId: 'getPostFeed',
      summary: 'Get infinite scroll video post feed',
      description:
         'Retrieves a batch of video posts (default 3 per batch) with embedded ingredients list, optimized for TikTok-style infinite scrolling using cursor-based pagination.',
   })
   @ApiResponse({
      status: HttpStatus.OK,
      description: 'Post feed batch retrieved successfully.',
      type: PostFeedResponseDto,
   })
   @ApiErrorResponses([
      {
         status: HttpStatus.BAD_REQUEST,
         description: 'Invalid pagination cursor format or parameters',
         errorCodes: [POST_ERROR_CODES.INVALID_CURSOR, COMMON_ERROR_CODES.INVALID_REQUEST],
      },
   ])
   @ResponseMessage(POST_RESPONSE_MESSAGES.GET_FEED_SUCCESS)
   async getFeed(
      @Query() query: GetPostFeedDto,
      @CurrentUser() user?: JwtPayload | null,
   ): Promise<PostFeedResponseDto> {
      return this.postsService.getFeed(query, user?.sub);
   }

   @Get(':postId')
   @Public()
   @HttpCode(HttpStatus.OK)
   @ApiOperation({
      operationId: 'getPostById',
      summary: 'Get post details by ID',
      description: 'Retrieves single post metadata by its unique UUID.',
   })
   @ApiParam({
      name: 'postId',
      description: 'Unique UUID identifier of the post',
      example: '0192e21b-0002-7000-8000-000000000001',
   })
   @ApiQuery({
      name: 'bypassReadModel',
      required: false,
      description: 'Flag to bypass CQRS Read-Model and read directly from Master DB (Read-Your-Own-Writes)',
      type: Boolean,
   })
   @ApiResponse({
      status: HttpStatus.OK,
      description: 'Post details retrieved successfully.',
      type: PostItemDto,
   })
   @ApiErrorResponses([
      {
         status: HttpStatus.NOT_FOUND,
         description: 'Post not found',
         errorCodes: [POST_ERROR_CODES.POST_NOT_FOUND],
      },
   ])
   @ResponseMessage(POST_RESPONSE_MESSAGES.GET_POST_SUCCESS)
   async getPostById(
      @Param('postId') postId: string,
      @CurrentUser() user?: JwtPayload | null,
      @Query('bypassReadModel') bypassReadModel?: string,
   ): Promise<PostItemDto> {
      return this.postsService.getPostById(postId, user?.sub, bypassReadModel === 'true' || bypassReadModel === '1');
   }

   @Get(':postId/ingredients')
   @Public()
   @HttpCode(HttpStatus.OK)
   @ApiOperation({
      operationId: 'getPostIngredients',
      summary: 'Get dish ingredients for a video post with e-commerce links',
      description: `### Workflow: Recipe to E-Commerce Conversion
#### Prerequisites
- Valid recipe post ID.

#### Process Flow
- Retrieves standardized ingredients selected by the creator for this video dish (used in the "View Ingredients" dialog/drawer).

#### Next Step
- Call \`GET /api/v1/commerce/ingredients/:ingredientId/suppliers\` to discover merchants selling the selected ingredient.`,
   })
   @ApiParam({
      name: 'postId',
      description: 'Unique UUID identifier of the post',
      example: '0192e21b-0002-7000-8000-000000000001',
   })
   @ApiResponse({
      status: HttpStatus.OK,
      description: 'Ingredients list retrieved successfully.',
      type: [PostIngredientDto],
      links: {
         GetSuppliersByIngredient: {
            operationId: 'getSuppliersByIngredient',
            description: 'View merchants and purchasing offers for the first ingredient in the recipe',
            parameters: {
               ingredientId: '$response.body#/data/0/ingredientId',
            },
         },
      },
   })
   @ApiErrorResponses([
      {
         status: HttpStatus.NOT_FOUND,
         description: 'Post not found',
         errorCodes: [POST_ERROR_CODES.POST_NOT_FOUND],
      },
   ])
   @ResponseMessage(POST_RESPONSE_MESSAGES.GET_INGREDIENTS_SUCCESS)
   async getIngredients(@Param('postId') postId: string): Promise<PostIngredientDto[]> {
      return this.postsService.getIngredients(postId);
   }
}
