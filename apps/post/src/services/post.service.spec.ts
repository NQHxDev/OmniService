import { Test, TestingModule } from '@nestjs/testing';
import { PostService } from '@post/services';
import { POST_REPOSITORY_TOKEN, type IPostRepository } from '@post/repositories';
import { PostEntity, PostIngredientEntity } from '@post/entities';
import { BadRequestException, NotFoundException, SERVICES } from '@common';
import { POST_EVENT_KEYS, type CreatePostDto } from '@contracts/post';

describe('PostService', () => {
   let service: PostService;
   let repository: jest.Mocked<IPostRepository>;
   let searchClient: { emit: jest.Mock };
   let notificationClient: { emit: jest.Mock };

   const mockIngredientEntity = new PostIngredientEntity({
      ingredientId: 'ing-1',
      postId: 'post-1',
      name: 'Thịt bò',
      amount: 500 as unknown as import('@post/prisma-client').Prisma.Decimal,
      unit: 'g',
      group: 'Nguyên liệu chính',
      sortOrder: 1,
   });

   const mockPostEntity = new PostEntity({
      postId: 'post-1',
      userId: 'user-1',
      title: 'Hanoi Beef Pho',
      caption: 'Pho tutorial #phobo',
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
      createdAt: new Date('2026-10-17T08:00:00.000Z'),
      updatedAt: new Date('2026-10-17T08:00:00.000Z'),
      ingredients: [
         {
            ingredientId: 'ing-1',
            postId: 'post-1',
            name: 'Thịt bò',
            amount: 500 as unknown as import('@post/prisma-client').Prisma.Decimal,
            unit: 'g',
            group: 'Nguyên liệu chính',
            sortOrder: 1,
         },
      ],
      tagNames: ['phobo'],
      mentionedUserIds: ['user-2'],
   });

   beforeEach(async () => {
      const mockRepo: Partial<IPostRepository> = {
         findFeed: jest.fn(),
         findById: jest.fn(),
         findIngredientsByPostId: jest.fn(),
         create: jest.fn(),
      };

      searchClient = { emit: jest.fn() };
      notificationClient = { emit: jest.fn() };

      const module: TestingModule = await Test.createTestingModule({
         providers: [
            PostService,
            {
               provide: POST_REPOSITORY_TOKEN,
               useValue: mockRepo,
            },
            {
               provide: SERVICES.SEARCH_SERVICE,
               useValue: searchClient,
            },
            {
               provide: SERVICES.NOTIFICATION_SERVICE,
               useValue: notificationClient,
            },
         ],
      }).compile();

      service = module.get<PostService>(PostService);
      repository = module.get(POST_REPOSITORY_TOKEN);
   });

   it('should be defined', () => {
      expect(service).toBeDefined();
   });

   describe('getFeed', () => {
      it('should return feed items and nextCursor with default limit 3', async () => {
         repository.findFeed.mockResolvedValue({
            items: [mockPostEntity],
            nextCursor: {
               createdAt: mockPostEntity.createdAt,
               postId: mockPostEntity.postId,
            },
            hasMore: true,
         });

         const result = await service.getFeed({});

         expect(repository.findFeed).toHaveBeenCalledWith({
            cursor: undefined,
            limit: 3,
            userId: undefined,
            tag: undefined,
            category: undefined,
         });

         expect(result.items).toHaveLength(1);
         expect(result.items[0].postId).toBe('post-1');
         expect(result.items[0].ingredients).toHaveLength(1);
         expect(result.items[0].ingredients[0].ingredientId).toBe('ing-1');
         expect(result.hasMore).toBe(true);
         expect(result.nextCursor).toBeDefined();
      });

      it('should decode a valid base64 cursor correctly', async () => {
         const cursorObj = {
            createdAt: '2026-10-17T08:00:00.000Z',
            postId: 'post-1',
         };
         const encodedCursor = Buffer.from(JSON.stringify(cursorObj)).toString('base64');

         repository.findFeed.mockResolvedValue({
            items: [],
            nextCursor: null,
            hasMore: false,
         });

         await service.getFeed({ cursor: encodedCursor, limit: 5 });

         expect(repository.findFeed).toHaveBeenCalledWith(
            expect.objectContaining({
               cursor: {
                  createdAt: new Date('2026-10-17T08:00:00.000Z'),
                  postId: 'post-1',
               },
               limit: 5,
            }),
         );
      });

      it('should throw BadRequestException when cursor is invalid', async () => {
         await expect(service.getFeed({ cursor: 'invalid-non-base64-json' })).rejects.toThrow(BadRequestException);
      });
   });

   describe('getPostById', () => {
      it('should return post detail when found', async () => {
         repository.findById.mockResolvedValue(mockPostEntity);

         const result = await service.getPostById('post-1');

         expect(result.postId).toBe('post-1');
         expect(result.title).toBe('Hanoi Beef Pho');
         expect(result.ingredients[0].ingredientId).toBe('ing-1');
      });

      it('should throw NotFoundException when post not found', async () => {
         repository.findById.mockResolvedValue(null);

         await expect(service.getPostById('non-existent')).rejects.toThrow(NotFoundException);
      });
   });

   describe('getIngredientsByPostId', () => {
      it('should return ingredients when post exists', async () => {
         repository.findById.mockResolvedValue(mockPostEntity);
         repository.findIngredientsByPostId.mockResolvedValue([mockIngredientEntity]);

         const result = await service.getIngredientsByPostId('post-1');

         expect(result).toHaveLength(1);
         expect(result[0].ingredientId).toBe('ing-1');
         expect(result[0].name).toBe('Thịt bò');
      });

      it('should throw NotFoundException when post does not exist', async () => {
         repository.findById.mockResolvedValue(null);

         await expect(service.getIngredientsByPostId('non-existent')).rejects.toThrow(NotFoundException);
      });
   });

   describe('createPost', () => {
      const validDto: CreatePostDto = {
         title: 'Hanoi Beef Pho',
         caption: 'Pho tutorial #phobo',
         videoUrl: 'https://r2.dev/video.mp4',
         thumbnailUrl: 'https://r2.dev/thumb.jpg',
         duration: 45,
         tags: ['phobo'],
         mentionedUserIds: ['user-2'],
      };

      it('should create post and emit event to search and notification clients', async () => {
         repository.create.mockResolvedValue(mockPostEntity);

         const result = await service.createPost('user-1', validDto);

         expect(repository.create).toHaveBeenCalledWith('user-1', validDto);
         expect(searchClient.emit).toHaveBeenCalledWith(
            'post.created',
            expect.objectContaining({
               eventId: POST_EVENT_KEYS.buildCreatedEventId('post-1'),
               idempotencyKey: POST_EVENT_KEYS.buildCreatedIdempotencyKey('post-1'),
               postId: 'post-1',
               userId: 'user-1',
               title: 'Hanoi Beef Pho',
            }),
         );
         expect(notificationClient.emit).toHaveBeenCalledWith(
            'post.created',
            expect.objectContaining({
               postId: 'post-1',
               mentionedUserIds: ['user-2'],
            }),
         );
         expect(result.postId).toBe('post-1');
      });

      it('should throw BadRequestException when userId is missing', async () => {
         await expect(service.createPost('', validDto)).rejects.toThrow(BadRequestException);
      });

      it('should throw BadRequestException when required media parameters are missing', async () => {
         await expect(service.createPost('user-1', { ...validDto, videoUrl: '' })).rejects.toThrow(BadRequestException);
      });
   });
});
