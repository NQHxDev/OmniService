import { PostSearchService } from '@search/domains/post-search/post-search.service';
import type { ElasticsearchService } from '@search/core/elasticsearch';
import type { PostCounterService } from '@search/domains/post-search/post-counter.service';
import type { AppLogger } from '@common';

describe('PostSearchService', () => {
   let service: PostSearchService;

   const mockEsClient = {
      indices: {
         exists: jest.fn(),
         create: jest.fn(),
      },
      search: jest.fn(),
      get: jest.fn(),
      index: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      updateByQuery: jest.fn(),
   };

   const mockElasticsearchService = {
      getClient: jest.fn().mockReturnValue(mockEsClient),
   };

   const mockPostCounterService = {
      getCounters: jest.fn(),
      getMultiCounters: jest.fn(),
      setCounters: jest.fn(),
      deleteCounters: jest.fn(),
   };

   const mockLogger = {
      setContext: jest.fn(),
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
   };

   beforeEach(() => {
      jest.clearAllMocks();
      service = new PostSearchService(
         mockElasticsearchService as unknown as ElasticsearchService,
         mockPostCounterService as unknown as PostCounterService,
         mockLogger as unknown as AppLogger,
      );
   });

   describe('onModuleInit', () => {
      it('should create index if it does not exist', async () => {
         mockEsClient.indices.exists.mockResolvedValue(false);
         mockEsClient.indices.create.mockResolvedValue({ acknowledged: true });

         await service.onModuleInit();

         expect(mockEsClient.indices.exists).toHaveBeenCalledWith({ index: 'feed_posts_read_model' });
         expect(mockEsClient.indices.create).toHaveBeenCalled();
      });

      it('should not create index if it already exists', async () => {
         mockEsClient.indices.exists.mockResolvedValue(true);

         await service.onModuleInit();

         expect(mockEsClient.indices.create).not.toHaveBeenCalled();
      });
   });

   describe('getFeed', () => {
      it('should query Elasticsearch with search_after and hydrate dynamic counters from Redis', async () => {
         const mockDoc = {
            postId: 'p-1',
            userId: 'u-1',
            title: 'Pho Bo',
            videoUrl: 'https://cdn.example.com/video.mp4',
            thumbnailUrl: 'https://cdn.example.com/thumb.jpg',
            duration: 45,
            allowComments: true,
            allowDuet: false,
            createdAt: new Date('2026-10-01T00:00:00.000Z'),
            updatedAt: new Date('2026-10-01T00:00:00.000Z'),
            author: { userId: 'u-1' },
            ingredients: [],
         };

         mockEsClient.search.mockResolvedValue({
            hits: {
               total: { value: 1, relation: 'eq' },
               hits: [
                  {
                     _source: mockDoc,
                     sort: [1760000000000, 'p-1'],
                  },
               ],
            },
         });

         const countersMap = new Map([
            [
               'p-1',
               {
                  likes: 42,
                  views: 1000,
                  comments: 7,
                  shares: 3,
                  saves: 15,
               },
            ],
         ]);
         mockPostCounterService.getMultiCounters.mockResolvedValue(countersMap);

         const result = await service.getFeed({ limit: 10 });

         expect(mockEsClient.search).toHaveBeenCalled();
         expect(mockPostCounterService.getMultiCounters).toHaveBeenCalledWith(['p-1']);
         expect(result.items).toHaveLength(1);
         expect(result.items[0].likeCount).toBe(42);
         expect(result.items[0].viewCount).toBe(1000);
         expect(result.hasMore).toBe(false);
      });
   });

   describe('getPostDetail', () => {
      it('should fetch post from ES and combine with Redis counters', async () => {
         const mockDoc = {
            postId: 'p-1',
            userId: 'u-1',
            title: 'Pho Bo',
            videoUrl: 'https://cdn.example.com/video.mp4',
            thumbnailUrl: 'https://cdn.example.com/thumb.jpg',
            duration: 45,
            allowComments: true,
            allowDuet: false,
            createdAt: new Date('2026-10-01T00:00:00.000Z'),
            updatedAt: new Date('2026-10-01T00:00:00.000Z'),
            author: { userId: 'u-1' },
            ingredients: [],
         };

         mockEsClient.get.mockResolvedValue({ _source: mockDoc });
         mockPostCounterService.getCounters.mockResolvedValue({
            likes: 99,
            views: 5000,
            comments: 10,
            shares: 4,
            saves: 20,
         });

         const result = await service.getPostDetail('p-1');

         expect(result).not.toBeNull();
         expect(result?.postId).toBe('p-1');
         expect(result?.likeCount).toBe(99);
         expect(result?.viewCount).toBe(5000);
      });

      it('should return null if ES document does not exist', async () => {
         mockEsClient.get.mockRejectedValue({ statusCode: 404 });

         const result = await service.getPostDetail('non-existent');

         expect(result).toBeNull();
      });
   });

   describe('indexPost', () => {
      it('should index static document in ES and set counters in Redis', async () => {
         mockEsClient.index.mockResolvedValue({ result: 'created' });
         mockPostCounterService.setCounters.mockResolvedValue(undefined);

         await service.indexPost({
            postId: 'p-1',
            userId: 'u-1',
            title: 'Pho',
            videoUrl: 'https://cdn.com/v.mp4',
            thumbnailUrl: 'https://cdn.com/t.jpg',
            duration: 60,
            allowComments: true,
            allowDuet: false,
            createdAt: new Date(),
            updatedAt: new Date(),
            author: { userId: 'u-1' },
            ingredients: [],
            likeCount: 10,
            viewCount: 100,
         });

         expect(mockEsClient.index).toHaveBeenCalledWith(
            expect.objectContaining({
               index: 'feed_posts_read_model',
               id: 'p-1',
            }),
         );
         expect(mockPostCounterService.setCounters).toHaveBeenCalledWith(
            'p-1',
            expect.objectContaining({
               likes: 10,
               views: 100,
            }),
         );
      });
   });

   describe('updateAuthorProfile', () => {
      it('should execute updateByQuery for all posts of author', async () => {
         mockEsClient.updateByQuery.mockResolvedValue({ updated: 5 });

         await service.updateAuthorProfile('u-1', {
            displayName: 'Updated Name',
            avatarUrl: 'https://cdn.com/new-avatar.jpg',
         });

         expect(mockEsClient.updateByQuery).toHaveBeenCalledWith(
            expect.objectContaining({
               index: 'feed_posts_read_model',
            }),
         );
      });
   });
});
