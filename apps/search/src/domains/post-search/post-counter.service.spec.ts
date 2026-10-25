import { PostCounterService } from '@search/domains/post-search/post-counter.service';
import type { RedisService } from '@common';

describe('PostCounterService', () => {
   let service: PostCounterService;

   const mockRedisClient = {
      pipeline: jest.fn(),
      hset: jest.fn(),
   };

   const mockRedisService = {
      getClient: jest.fn().mockReturnValue(mockRedisClient),
      hgetall: jest.fn(),
      hincrby: jest.fn(),
      del: jest.fn(),
   };

   beforeEach(() => {
      jest.clearAllMocks();
      service = new PostCounterService(mockRedisService as unknown as RedisService);
   });

   describe('getCounters', () => {
      it('should fetch and parse counters from Redis hash', async () => {
         mockRedisService.hgetall.mockResolvedValue({
            likes: '10',
            views: '500',
            comments: '3',
            shares: '1',
            saves: '5',
         });

         const result = await service.getCounters('p-1');

         expect(mockRedisService.hgetall).toHaveBeenCalledWith('post:counters:p-1');
         expect(result).toEqual({
            likes: 10,
            views: 500,
            comments: 3,
            shares: 1,
            saves: 5,
         });
      });

      it('should return default 0s if Redis error occurs', async () => {
         mockRedisService.hgetall.mockRejectedValue(new Error('Redis connection failed'));

         const result = await service.getCounters('p-1');

         expect(result).toEqual({
            likes: 0,
            views: 0,
            comments: 0,
            shares: 0,
            saves: 0,
         });
      });
   });

   describe('getMultiCounters', () => {
      it('should return empty map for empty postIds list', async () => {
         const result = await service.getMultiCounters([]);
         expect(result.size).toBe(0);
      });

      it('should use pipeline when client is available', async () => {
         const mockPipeline = {
            hgetall: jest.fn().mockReturnThis(),
            exec: jest.fn().mockResolvedValue([
               [null, { likes: '5', views: '100' }],
               [null, { likes: '2', views: '50' }],
            ]),
         };
         mockRedisClient.pipeline.mockReturnValue(mockPipeline);

         const result = await service.getMultiCounters(['p-1', 'p-2']);

         expect(mockPipeline.hgetall).toHaveBeenCalledWith('post:counters:p-1');
         expect(mockPipeline.hgetall).toHaveBeenCalledWith('post:counters:p-2');
         expect(result.get('p-1')).toEqual({
            likes: 5,
            views: 100,
            comments: 0,
            shares: 0,
            saves: 0,
         });
         expect(result.get('p-2')).toEqual({
            likes: 2,
            views: 50,
            comments: 0,
            shares: 0,
            saves: 0,
         });
      });
   });

   describe('incrementCounter', () => {
      it('should call hincrby atomically on post hash key', async () => {
         mockRedisService.hincrby.mockResolvedValue(11);

         const result = await service.incrementCounter('p-1', 'likes', 1);

         expect(mockRedisService.hincrby).toHaveBeenCalledWith('post:counters:p-1', 'likes', 1);
         expect(result).toBe(11);
      });
   });

   describe('setCounters', () => {
      it('should set counters via client hset', async () => {
         mockRedisClient.hset.mockResolvedValue(1);

         await service.setCounters('p-1', { likes: 20, views: 1000 });

         expect(mockRedisClient.hset).toHaveBeenCalledWith('post:counters:p-1', {
            likes: '20',
            views: '1000',
         });
      });
   });

   describe('deleteCounters', () => {
      it('should delete post counters key', async () => {
         mockRedisService.del.mockResolvedValue(1);

         await service.deleteCounters('p-1');

         expect(mockRedisService.del).toHaveBeenCalledWith('post:counters:p-1');
      });
   });
});
