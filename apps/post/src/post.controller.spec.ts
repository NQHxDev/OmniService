import { Test, TestingModule } from '@nestjs/testing';
import { PostController } from '@post/post.controller';
import { PostService } from '@post/services';
import { RmqService } from '@common';
import { RmqContext } from '@nestjs/microservices';
import { type CreatePostDto, PostFeedResponseDto, PostItemDto } from '@contracts/post';

describe('PostController', () => {
   let controller: PostController;
   let service: PostService;
   let rmqService: RmqService;

   const mockPostItem: PostItemDto = {
      postId: 'post-1',
      userId: 'user-1',
      title: 'Hanoi Beef Pho',
      caption: 'Pho tutorial',
      mediaId: 'media-1',
      videoUrl: 'https://r2.dev/video.mp4',
      playbackUrl: null,
      thumbnailUrl: 'https://r2.dev/thumb.jpg',
      blurHash: 'LEHV6nWB',
      duration: 45,
      videoWidth: 1080,
      videoHeight: 1920,
      viewCount: 100,
      likeCount: 10,
      commentCount: 2,
      shareCount: 1,
      saveCount: 5,
      allowComments: true,
      allowDuet: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      ingredients: [],
   };

   const mockFeedResponse: PostFeedResponseDto = {
      items: [mockPostItem],
      nextCursor: 'next-cursor-token',
      hasMore: true,
   };

   const mockRmqContext = {
      getChannelRef: jest.fn().mockReturnValue({
         ack: jest.fn(),
      }),
      getMessage: jest.fn().mockReturnValue({}),
   } as unknown as RmqContext;

   beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
         controllers: [PostController],
         providers: [
            {
               provide: PostService,
               useValue: {
                  getFeed: jest.fn().mockResolvedValue(mockFeedResponse),
                  getPostById: jest.fn().mockResolvedValue(mockPostItem),
                  getIngredientsByPostId: jest.fn().mockResolvedValue([]),
                  createPost: jest.fn().mockResolvedValue(mockPostItem),
               },
            },
            {
               provide: RmqService,
               useValue: {
                  ack: jest.fn(),
                  handleError: jest.fn(),
               },
            },
         ],
      }).compile();

      controller = module.get<PostController>(PostController);
      service = module.get<PostService>(PostService);
      rmqService = module.get<RmqService>(RmqService);
   });

   it('should be defined', () => {
      expect(controller).toBeDefined();
   });

   describe('getFeed', () => {
      it('should return feed response and ack context', async () => {
         const dto = { limit: 3 };
         const result = await controller.getFeed(dto, mockRmqContext);

         expect(result).toEqual(mockFeedResponse);
         expect(service.getFeed).toHaveBeenCalledWith(dto);
         expect(rmqService.ack).toHaveBeenCalledWith(mockRmqContext);
      });
   });

   describe('getPostById', () => {
      it('should return post detail and ack context', async () => {
         const payload = { postId: 'post-1' };
         const result = await controller.getPostById(payload, mockRmqContext);

         expect(result).toEqual(mockPostItem);
         expect(service.getPostById).toHaveBeenCalledWith('post-1');
         expect(rmqService.ack).toHaveBeenCalledWith(mockRmqContext);
      });
   });

   describe('createPost', () => {
      it('should delegate to postService.createPost and ack context', async () => {
         const createDto: CreatePostDto = {
            title: 'Hanoi Beef Pho',
            videoUrl: 'https://r2.dev/video.mp4',
            thumbnailUrl: 'https://r2.dev/thumb.jpg',
            duration: 45,
         };
         const payload = { userId: 'user-1', dto: createDto };

         const result = await controller.createPost(payload, mockRmqContext);

         expect(result).toEqual(mockPostItem);
         expect(service.createPost).toHaveBeenCalledWith('user-1', createDto);
         expect(rmqService.ack).toHaveBeenCalledWith(mockRmqContext);
      });
   });
});
