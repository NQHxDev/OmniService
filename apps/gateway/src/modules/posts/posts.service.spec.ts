import { Test, TestingModule } from '@nestjs/testing';
import { of, throwError } from 'rxjs';
import { BulkheadRegistry, CircuitBreakerRegistry, RedisService } from '@common';
import { SEARCH_V1_GRPC_CLIENT, type IPostSearchHitProto } from '@contracts/search';
import {
   POST_CACHE_KEYS,
   POST_CACHE_TTL,
   POST_V1_GRPC_CLIENT,
   type IPostIngredientProto,
   type IPostItemProto,
} from '@contracts/post';
import { PostsService } from '@/modules/posts/posts.service';

describe('PostsService (CQRS Read-Model Single-Hop Delegation & Resilience)', () => {
   let service: PostsService;

   const mockSearchGrpcService = {
      getPostFeed: jest.fn(),
      getPostDetail: jest.fn(),
   };

   const mockSearchClient = {
      getService: jest.fn().mockReturnValue(mockSearchGrpcService),
   };

   const mockPostGrpcService = {
      getFeed: jest.fn(),
      getPostById: jest.fn(),
      getIngredientsByPostId: jest.fn(),
   };

   const mockPostClient = {
      getService: jest.fn().mockReturnValue(mockPostGrpcService),
   };

   const mockRedisService = {
      get: jest.fn(),
      set: jest.fn(),
      getJson: jest.fn(),
      setJson: jest.fn(),
   };

   const mockPostProto: IPostSearchHitProto = {
      postId: 'post-100',
      userId: 'user-200',
      title: 'Delicious Pho',
      caption: 'Vietnamese traditional soup',
      videoUrl: 'https://cdn.example.com/pho.mp4',
      thumbnailUrl: 'https://cdn.example.com/pho.jpg',
      duration: 50,
      allowComments: true,
      allowDuet: false,
      createdAt: '2026-10-10T12:00:00.000Z',
      updatedAt: '2026-10-10T12:00:00.000Z',
      author: {
         userId: 'user-200',
         displayName: 'Chef Anh',
         isVerified: true,
         followerCount: 1500,
      },
      ingredients: [
         {
            ingredientId: 'ing-1',
            name: 'Beef Broth',
            amount: 500,
            unit: 'ml',
            sortOrder: 1,
         },
      ],
      tags: ['pho', 'recipe'],
      category: 'soup',
      likeCount: 88,
      viewCount: 1500,
      commentCount: 12,
      shareCount: 5,
      saveCount: 30,
   };

   const mockMasterPostProto: IPostItemProto = {
      postId: 'post-master',
      userId: 'user-200',
      title: 'Master Post',
      videoUrl: 'https://cdn.example.com/master.mp4',
      thumbnailUrl: 'https://cdn.example.com/master.jpg',
      duration: 40,
      viewCount: 10,
      likeCount: 1,
      commentCount: 0,
      shareCount: 0,
      saveCount: 0,
      allowComments: true,
      allowDuet: false,
      createdAt: '2026-10-10T12:00:00.000Z',
      updatedAt: '2026-10-10T12:00:00.000Z',
      ingredients: [],
   };

   beforeEach(async () => {
      CircuitBreakerRegistry.clear();
      BulkheadRegistry.clear();
      jest.clearAllMocks();

      const module: TestingModule = await Test.createTestingModule({
         providers: [
            PostsService,
            { provide: SEARCH_V1_GRPC_CLIENT, useValue: mockSearchClient },
            { provide: POST_V1_GRPC_CLIENT, useValue: mockPostClient },
            { provide: RedisService, useValue: mockRedisService },
         ],
      }).compile();

      service = module.get<PostsService>(PostsService);
      service.onModuleInit();
   });

   describe('getFeed', () => {
      it('should delegate to Search gRPC service in a single hop', async () => {
         mockSearchGrpcService.getPostFeed.mockReturnValue(
            of({
               items: [mockPostProto],
               nextCursor: 'next-page-cursor',
               hasMore: true,
               total: 10,
            }),
         );

         const result = await service.getFeed({ limit: 5 });

         expect(mockSearchGrpcService.getPostFeed).toHaveBeenCalledWith(
            expect.objectContaining({
               limit: 5,
            }),
         );
         expect(result.items).toHaveLength(1);
         expect(result.items[0].postId).toBe('post-100');
         expect(result.items[0].likeCount).toBe(88);
         expect(result.items[0].viewCount).toBe(1500);
         expect(result.nextCursor).toBe('next-page-cursor');
         expect(result.hasMore).toBe(true);
      });

      it('should fallback to Post gRPC microservice when Search gRPC fails', async () => {
         mockSearchGrpcService.getPostFeed.mockReturnValue(throwError(() => new Error('Search gRPC unavailable')));
         mockPostGrpcService.getFeed.mockReturnValue(
            of({
               items: [mockMasterPostProto],
               nextCursor: null,
               hasMore: false,
            }),
         );

         const result = await service.getFeed({ limit: 3 });

         expect(mockPostGrpcService.getFeed).toHaveBeenCalled();
         expect(result.items).toHaveLength(1);
         expect(result.items[0].postId).toBe('post-master');
      });
   });

   describe('getPostById', () => {
      it('should return from Redis Read-Through cache if available', async () => {
         mockRedisService.get.mockResolvedValue(null);
         mockRedisService.getJson.mockResolvedValue({
            postId: 'post-cached',
            userId: 'user-1',
            title: 'Cached Post',
            videoUrl: 'https://cdn.example.com/cached.mp4',
            thumbnailUrl: 'https://cdn.example.com/cached.jpg',
            duration: 30,
            viewCount: 500,
            likeCount: 50,
            commentCount: 5,
            shareCount: 2,
            saveCount: 10,
            allowComments: true,
            allowDuet: false,
            createdAt: '2026-10-10T00:00:00.000Z',
            updatedAt: '2026-10-10T00:00:00.000Z',
            ingredients: [],
         });

         const result = await service.getPostById('post-cached');

         expect(mockRedisService.getJson).toHaveBeenCalledWith(POST_CACHE_KEYS.detail('post-cached'));
         expect(mockSearchGrpcService.getPostDetail).not.toHaveBeenCalled();
         expect(result.postId).toBe('post-cached');
         expect(result.createdAt).toBeInstanceOf(Date);
      });

      it('should bypass Read Model if author recently published this post (Read-Your-Own-Writes)', async () => {
         mockRedisService.get.mockResolvedValue('1');
         mockPostGrpcService.getPostById.mockReturnValue(
            of({
               post: {
                  ...mockMasterPostProto,
                  postId: 'post-fresh',
                  userId: 'author-123',
               },
            }),
         );

         const result = await service.getPostById('post-fresh', 'author-123');

         expect(mockPostGrpcService.getPostById).toHaveBeenCalledWith({ postId: 'post-fresh' });
         expect(mockSearchGrpcService.getPostDetail).not.toHaveBeenCalled();
         expect(result.postId).toBe('post-fresh');
      });

      it('should bypass Read Model if bypassReadModel flag is true', async () => {
         mockPostGrpcService.getPostById.mockReturnValue(
            of({
               post: {
                  ...mockMasterPostProto,
                  postId: 'post-direct',
               },
            }),
         );

         const result = await service.getPostById('post-direct', undefined, true);

         expect(mockPostGrpcService.getPostById).toHaveBeenCalledWith({ postId: 'post-direct' });
         expect(mockSearchGrpcService.getPostDetail).not.toHaveBeenCalled();
         expect(result.postId).toBe('post-direct');
      });

      it('should query Search gRPC and populate Redis cache on cache miss', async () => {
         mockRedisService.get.mockResolvedValue(null);
         mockRedisService.getJson.mockResolvedValue(null);
         mockSearchGrpcService.getPostDetail.mockReturnValue(of({ post: mockPostProto }));
         mockRedisService.setJson.mockResolvedValue(undefined);

         const result = await service.getPostById('post-100');

         expect(mockSearchGrpcService.getPostDetail).toHaveBeenCalledWith({ postId: 'post-100' });
         expect(mockRedisService.setJson).toHaveBeenCalledWith(
            POST_CACHE_KEYS.detail('post-100'),
            expect.objectContaining({ postId: 'post-100' }),
            POST_CACHE_TTL.DETAIL_SECONDS,
         );
         expect(result.postId).toBe('post-100');
         expect(result.title).toBe('Delicious Pho');
      });

      it('should fallback to Post gRPC microservice when Search gRPC fails', async () => {
         mockRedisService.get.mockResolvedValue(null);
         mockRedisService.getJson.mockResolvedValue(null);
         mockSearchGrpcService.getPostDetail.mockReturnValue(throwError(() => new Error('Connection refused')));
         mockPostGrpcService.getPostById.mockReturnValue(
            of({
               post: {
                  ...mockMasterPostProto,
                  postId: 'post-100',
                  title: 'Post From DB',
               },
            }),
         );

         const result = await service.getPostById('post-100');

         expect(mockPostGrpcService.getPostById).toHaveBeenCalledWith({ postId: 'post-100' });
         expect(result.postId).toBe('post-100');
         expect(result.title).toBe('Post From DB');
      });
   });

   describe('getIngredients', () => {
      it('should fetch ingredients list from Post gRPC microservice', async () => {
         const mockIngredients: IPostIngredientProto[] = [
            {
               ingredientId: 'ing-1',
               name: 'Ginger',
               amount: 50,
               unit: 'g',
               sortOrder: 1,
            },
         ];

         mockPostGrpcService.getIngredientsByPostId.mockReturnValue(
            of({
               items: mockIngredients,
            }),
         );

         const result = await service.getIngredients('post-100');

         expect(mockPostGrpcService.getIngredientsByPostId).toHaveBeenCalledWith({ postId: 'post-100' });
         expect(result).toHaveLength(1);
         expect(result[0].name).toBe('Ginger');
      });
   });
});
