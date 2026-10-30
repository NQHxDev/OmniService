import { AnalyzeCacheService } from './analyze-cache.service';
import { RedisService } from '@common';
import { ANALYZE_CACHE_KEYS } from '@contracts/analyze';

describe('AnalyzeCacheService', () => {
   let service: AnalyzeCacheService;
   let mockRedisService: jest.Mocked<RedisService>;
   let mockClient: {
      pipeline: jest.Mock;
      zrevrangebyscore: jest.Mock;
      zrevrange: jest.Mock;
   };
   let mockPipeline: {
      zincrby: jest.Mock;
      zadd: jest.Mock;
      zremrangebyscore: jest.Mock;
      zremrangebyrank: jest.Mock;
      expire: jest.Mock;
      exec: jest.Mock;
   };

   beforeEach(() => {
      mockPipeline = {
         zincrby: jest.fn().mockReturnThis(),
         zadd: jest.fn().mockReturnThis(),
         zremrangebyscore: jest.fn().mockReturnThis(),
         zremrangebyrank: jest.fn().mockReturnThis(),
         expire: jest.fn().mockReturnThis(),
         exec: jest.fn().mockResolvedValue([]),
      };

      mockClient = {
         pipeline: jest.fn().mockReturnValue(mockPipeline),
         zrevrangebyscore: jest.fn(),
         zrevrange: jest.fn(),
      };

      mockRedisService = {
         getClient: jest.fn().mockReturnValue(mockClient),
      } as unknown as jest.Mocked<RedisService>;

      service = new AnalyzeCacheService(mockRedisService);
   });

   it('should update category affinity scores via pipeline', async () => {
      await service.updateCategoryAffinity('user-1', ['cat-1', 'cat-2'], 3);

      expect(mockPipeline.zincrby).toHaveBeenCalledTimes(2);
      expect(mockPipeline.zincrby).toHaveBeenCalledWith(ANALYZE_CACHE_KEYS.userAffinity('user-1'), 3, 'cat-1');
      expect(mockPipeline.zincrby).toHaveBeenCalledWith(ANALYZE_CACHE_KEYS.userAffinity('user-1'), 3, 'cat-2');
      expect(mockPipeline.expire).toHaveBeenCalled();
      expect(mockPipeline.exec).toHaveBeenCalled();
   });

   it('should get top categories filtering only positive scores', async () => {
      mockClient.zrevrangebyscore.mockResolvedValue(['cat-tech', '10.5', 'cat-news', '4.2']);

      const results = await service.getTopCategories('user-1', 5);

      expect(mockClient.zrevrangebyscore).toHaveBeenCalledWith(
         ANALYZE_CACHE_KEYS.userAffinity('user-1'),
         '+inf',
         '(0',
         'WITHSCORES',
         'LIMIT',
         0,
         5,
      );
      expect(results).toEqual([
         { categoryId: 'cat-tech', score: 10.5 },
         { categoryId: 'cat-news', score: 4.2 },
      ]);
   });

   it('should mark video as seen with bounded prune pipeline', async () => {
      await service.markVideoAsSeen('user-1', 'vid-100');

      expect(mockPipeline.zadd).toHaveBeenCalledWith(
         ANALYZE_CACHE_KEYS.seenVideos('user-1'),
         expect.any(Number),
         'vid-100',
      );
      expect(mockPipeline.zremrangebyscore).toHaveBeenCalled();
      expect(mockPipeline.zremrangebyrank).toHaveBeenCalledWith(ANALYZE_CACHE_KEYS.seenVideos('user-1'), 0, -1001);
      expect(mockPipeline.expire).toHaveBeenCalled();
      expect(mockPipeline.exec).toHaveBeenCalled();
   });

   it('should retrieve bounded seen video ids ordered from newest to oldest', async () => {
      mockClient.zrevrange.mockResolvedValue(['vid-2', 'vid-1']);

      const results = await service.getSeenVideoIds('user-1', 10);

      expect(mockClient.zrevrange).toHaveBeenCalledWith(ANALYZE_CACHE_KEYS.seenVideos('user-1'), 0, 9);
      expect(results).toEqual(['vid-2', 'vid-1']);
   });
});
