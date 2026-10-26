import { Test, TestingModule } from '@nestjs/testing';
import { AppLogger } from '@common';
import { ElasticsearchService } from '@search/core/elasticsearch';
import { METRIC_STATUS } from '@search/core/metrics';
import { UserSearchService } from '@search/domains/user-search/user-search.service';

describe('UserSearchService', () => {
   let service: UserSearchService;

   const mockClient = {
      indices: {
         exists: jest.fn().mockResolvedValue(true),
         create: jest.fn().mockResolvedValue({}),
      },
      index: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
      search: jest.fn().mockResolvedValue({
         hits: {
            total: { value: 1 },
            hits: [
               {
                  _source: {
                     id: 'user-1',
                     username: 'john',
                     displayName: 'John Doe',
                     createdAt: new Date(),
                     updatedAt: new Date(),
                  },
                  sort: ['sort-val', 'user-1'],
               },
            ],
         },
      }),
   };

   const mockElasticsearchService = {
      getClient: jest.fn().mockReturnValue(mockClient),
   };

   const mockLogger = {
      setContext: jest.fn(),
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
   };

   const mockTimer = jest.fn();
   const mockCounter = { inc: jest.fn() };
   const mockHistogram = { startTimer: jest.fn().mockReturnValue(mockTimer) };

   beforeEach(async () => {
      jest.clearAllMocks();

      const module: TestingModule = await Test.createTestingModule({
         providers: [
            UserSearchService,
            {
               provide: ElasticsearchService,
               useValue: mockElasticsearchService,
            },
            {
               provide: AppLogger,
               useValue: mockLogger,
            },
            {
               provide: 'PROM_METRIC_SEARCH_QUERY_TOTAL',
               useValue: mockCounter,
            },
            {
               provide: 'PROM_METRIC_SEARCH_QUERY_DURATION_SECONDS',
               useValue: mockHistogram,
            },
            {
               provide: 'PROM_METRIC_SEARCH_INDEXING_TOTAL',
               useValue: mockCounter,
            },
         ],
      }).compile();

      service = module.get<UserSearchService>(UserSearchService);
   });

   it('should be defined', () => {
      expect(service).toBeDefined();
   });

   describe('indexUser', () => {
      it('should index user document in elasticsearch and inc metric', async () => {
         await service.indexUser({
            id: 'user-1',
            username: 'john',
            displayName: 'John Doe',
         });

         expect(mockClient.index).toHaveBeenCalledWith(
            expect.objectContaining({
               index: 'users',
               id: 'user-1',
            }),
         );
         expect(mockCounter.inc).toHaveBeenCalledWith({
            index: 'users',
            operation: 'index',
            status: 'success',
         });
      });

      it('should track error metric when indexing fails', async () => {
         mockClient.index.mockRejectedValue(new Error('Index fail'));

         await expect(
            service.indexUser({
               id: 'user-1',
               username: 'john',
            }),
         ).rejects.toThrow('Index fail');

         expect(mockCounter.inc).toHaveBeenCalledWith({
            index: 'users',
            operation: 'index',
            status: METRIC_STATUS.ERROR,
         });
      });
   });

   describe('updateUser', () => {
      it('should update user document in elasticsearch and inc metric', async () => {
         await service.updateUser({
            id: 'user-1',
            username: 'john_updated',
         });

         expect(mockClient.update).toHaveBeenCalledWith(
            expect.objectContaining({
               index: 'users',
               id: 'user-1',
            }),
         );
         expect(mockCounter.inc).toHaveBeenCalledWith({
            index: 'users',
            operation: 'update',
            status: METRIC_STATUS.SUCCESS,
         });
      });
   });

   describe('deleteUser', () => {
      it('should delete user document from elasticsearch and inc metric', async () => {
         await service.deleteUser('user-1');

         expect(mockClient.delete).toHaveBeenCalledWith({
            index: 'users',
            id: 'user-1',
         });
         expect(mockCounter.inc).toHaveBeenCalledWith({
            index: 'users',
            operation: 'delete',
            status: METRIC_STATUS.SUCCESS,
         });
      });
   });

   describe('searchUsers', () => {
      it('should return empty result for empty query', async () => {
         const result = await service.searchUsers('');
         expect(result).toEqual({ items: [], nextCursor: null, hasMore: false, total: 0 });
      });

      it('should search users and return items with cursor, recording duration metric', async () => {
         const result = await service.searchUsers('john', 10);
         expect(mockClient.search).toHaveBeenCalled();
         expect(mockHistogram.startTimer).toHaveBeenCalledWith({ index: 'users' });
         expect(mockCounter.inc).toHaveBeenCalledWith({ index: 'users', status: METRIC_STATUS.SUCCESS });
         expect(mockTimer).toHaveBeenCalledWith({ status: METRIC_STATUS.SUCCESS });
         expect(result.items).toHaveLength(1);
         expect(result.items[0].username).toBe('john');
      });

      it('should record error metric when search query fails', async () => {
         mockClient.search.mockRejectedValue(new Error('ES search failed'));

         const result = await service.searchUsers('fail-query', 10);
         expect(mockCounter.inc).toHaveBeenCalledWith({ index: 'users', status: METRIC_STATUS.ERROR });
         expect(mockTimer).toHaveBeenCalledWith({ status: METRIC_STATUS.ERROR });
         expect(result.items).toEqual([]);
      });
   });
});
