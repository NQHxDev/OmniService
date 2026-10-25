import { Test, TestingModule } from '@nestjs/testing';
import { firstValueFrom } from 'rxjs';
import { PostGrpcController } from '@post/adapters/grpc/post-grpc.controller';
import { PostService } from '@post/services';
import type { PostFeedResponseDto, PostIngredientDto, PostItemDto } from '@contracts/post';

describe('PostGrpcController', () => {
   let controller: PostGrpcController;
   let postService: jest.Mocked<PostService>;

   const mockPostItem: PostItemDto = {
      postId: 'post-1',
      userId: 'user-1',
      title: 'Delicious Pho',
      caption: 'Vietnamese traditional soup',
      mediaId: 'media-1',
      videoUrl: 'https://example.com/video.mp4',
      playbackUrl: 'https://example.com/video.m3u8',
      thumbnailUrl: 'https://example.com/thumb.jpg',
      blurHash: 'L6PZfSi_',
      duration: 60,
      videoWidth: 1080,
      videoHeight: 1920,
      viewCount: 100,
      likeCount: 10,
      commentCount: 5,
      shareCount: 2,
      saveCount: 8,
      allowComments: true,
      allowDuet: true,
      createdAt: new Date('2026-10-25T10:00:00.000Z'),
      updatedAt: new Date('2026-10-25T10:00:00.000Z'),
      ingredients: [
         {
            ingredientId: 'ing-1',
            name: 'Beef',
            amount: 200,
            unit: 'g',
            group: 'Main',
            sortOrder: 1,
            catalogIngredientId: 'cat-ing-1',
         },
      ],
   };

   const mockFeedResponse: PostFeedResponseDto = {
      items: [mockPostItem],
      nextCursor: 'next-cur',
      hasMore: true,
   };

   const mockIngredients: PostIngredientDto[] = [
      {
         ingredientId: 'ing-1',
         name: 'Beef',
         amount: 200,
         unit: 'g',
         group: 'Main',
         sortOrder: 1,
         catalogIngredientId: 'cat-ing-1',
      },
   ];

   beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
         controllers: [PostGrpcController],
         providers: [
            {
               provide: PostService,
               useValue: {
                  getFeed: jest.fn().mockResolvedValue(mockFeedResponse),
                  getPostById: jest.fn().mockResolvedValue(mockPostItem),
                  getIngredientsByPostId: jest.fn().mockResolvedValue(mockIngredients),
               },
            },
         ],
      }).compile();

      controller = module.get<PostGrpcController>(PostGrpcController);
      postService = module.get(PostService);
   });

   describe('getFeed', () => {
      it('should retrieve feed through PostService and map to proto response', async () => {
         const response = await firstValueFrom(
            controller.getFeed({
               limit: 10,
               cursor: 'cur-1',
               userId: 'user-1',
               tag: 'soup',
               category: 'vietnamese',
            }),
         );

         expect(postService.getFeed).toHaveBeenCalledWith({
            limit: 10,
            cursor: 'cur-1',
            userId: 'user-1',
            tag: 'soup',
            category: 'vietnamese',
         });
         expect(response.items).toHaveLength(1);
         expect(response.items[0].postId).toBe('post-1');
         expect(response.items[0].ingredients?.[0].name).toBe('Beef');
         expect(response.nextCursor).toBe('next-cur');
         expect(response.hasMore).toBe(true);
      });
   });

   describe('getPostById', () => {
      it('should retrieve post detail through PostService and map to proto response', async () => {
         const response = await firstValueFrom(controller.getPostById({ postId: 'post-1' }));

         expect(postService.getPostById).toHaveBeenCalledWith('post-1');
         expect(response.post.postId).toBe('post-1');
         expect(response.post.title).toBe('Delicious Pho');
         expect(response.post.ingredients).toHaveLength(1);
      });
   });

   describe('getIngredientsByPostId', () => {
      it('should retrieve ingredients through PostService and map to proto response', async () => {
         const response = await firstValueFrom(controller.getIngredientsByPostId({ postId: 'post-1' }));

         expect(postService.getIngredientsByPostId).toHaveBeenCalledWith('post-1');
         expect(response.items).toHaveLength(1);
         expect(response.items[0].ingredientId).toBe('ing-1');
         expect(response.items[0].amount).toBe(200);
      });
   });
});
