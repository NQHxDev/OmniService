import { Test, TestingModule } from '@nestjs/testing';
import { PostsController } from '@/modules/posts/posts.controller';
import { PostsService } from '@/modules/posts/posts.service';
import type { PostFeedResponseDto, PostIngredientDto, PostItemDto } from '@contracts/post';

describe('PostsController', () => {
   let controller: PostsController;

   const mockPostsService = {
      getFeed: jest.fn(),
      getPostById: jest.fn(),
      getIngredients: jest.fn(),
   };

   beforeEach(async () => {
      jest.clearAllMocks();

      const module: TestingModule = await Test.createTestingModule({
         controllers: [PostsController],
         providers: [{ provide: PostsService, useValue: mockPostsService }],
      }).compile();

      controller = module.get<PostsController>(PostsController);
   });

   describe('getFeed', () => {
      it('should delegate feed request to PostsService with current user id', async () => {
         const mockFeed: PostFeedResponseDto = {
            items: [],
            nextCursor: null,
            hasMore: false,
         };
         mockPostsService.getFeed.mockResolvedValue(mockFeed);

         const result = await controller.getFeed(
            { limit: 3, cursor: 'cur-1' },
            {
               sub: 'user-1',
               email: 'test@example.com',
            },
         );

         expect(mockPostsService.getFeed).toHaveBeenCalledWith({ limit: 3, cursor: 'cur-1' }, 'user-1');
         expect(result).toBe(mockFeed);
      });
   });

   describe('getPostById', () => {
      it('should delegate getPostById to PostsService with bypassReadModel flag', async () => {
         const mockPost: PostItemDto = {
            postId: 'p-1',
            userId: 'u-1',
            title: 'Pho Bo',
            videoUrl: 'https://cdn.example.com/v.mp4',
            thumbnailUrl: 'https://cdn.example.com/t.jpg',
            duration: 30,
            viewCount: 100,
            likeCount: 10,
            commentCount: 2,
            shareCount: 1,
            saveCount: 3,
            allowComments: true,
            allowDuet: false,
            createdAt: new Date(),
            updatedAt: new Date(),
            ingredients: [],
         };
         mockPostsService.getPostById.mockResolvedValue(mockPost);

         const result = await controller.getPostById('p-1', null, 'true');

         expect(mockPostsService.getPostById).toHaveBeenCalledWith('p-1', undefined, true);
         expect(result).toBe(mockPost);
      });
   });

   describe('getIngredients', () => {
      it('should return ingredients list for post', async () => {
         const mockIngredients: PostIngredientDto[] = [
            {
               ingredientId: 'ing-1',
               name: 'Cinnamon',
               amount: 10,
               unit: 'g',
               sortOrder: 1,
            },
         ];
         mockPostsService.getIngredients.mockResolvedValue(mockIngredients);

         const result = await controller.getIngredients('p-1');

         expect(mockPostsService.getIngredients).toHaveBeenCalledWith('p-1');
         expect(result).toBe(mockIngredients);
      });
   });
});
