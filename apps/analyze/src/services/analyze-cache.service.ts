import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '@common';
import { ANALYZE_CACHE_KEYS, ANALYZE_CACHE_TTL } from '@contracts/analyze';

export interface CategoryScoreResult {
   categoryId: string;
   score: number;
}

@Injectable()
export class AnalyzeCacheService {
   private readonly logger = new Logger(AnalyzeCacheService.name);

   constructor(private readonly redisService: RedisService) {}

   /**
    * Increments/decrements user affinity score for given category IDs using Redis Sorted Sets (ZINCRBY).
    */
   async updateCategoryAffinity(userId: string, categoryIds: string[], scoreDelta: number): Promise<void> {
      if (!categoryIds || categoryIds.length === 0 || scoreDelta === 0) {
         return;
      }

      const client = this.redisService.getClient();
      if (!client) {
         this.logger.warn('Redis client is not available');
         return;
      }

      const key = ANALYZE_CACHE_KEYS.userAffinity(userId);
      const pipeline = client.pipeline();

      for (const catId of categoryIds) {
         pipeline.zincrby(key, scoreDelta, catId);
      }
      pipeline.expire(key, ANALYZE_CACHE_TTL.AFFINITY_SECONDS);

      await pipeline.exec();
   }

   /**
    * Retrieves the top categories for a user ordered by highest affinity score.
    * Only returns categories with positive affinity (score > 0).
    */
   async getTopCategories(userId: string, limit = 5): Promise<CategoryScoreResult[]> {
      const client = this.redisService.getClient();
      if (!client) {
         this.logger.warn('Redis client is not available');
         return [];
      }

      const key = ANALYZE_CACHE_KEYS.userAffinity(userId);
      const safeLimit = Math.max(1, limit);
      // Redis ZREVRANGEBYSCORE key +inf (0 WITHSCORES LIMIT 0 limit
      // '(0' denotes strictly greater than 0
      const rawResults = await client.zrevrangebyscore(key, '+inf', '(0', 'WITHSCORES', 'LIMIT', 0, safeLimit);
      const results: CategoryScoreResult[] = [];

      for (let i = 0; i < rawResults.length; i += 2) {
         const categoryId = rawResults[i];
         const score = parseFloat(rawResults[i + 1] || '0');
         if (categoryId) {
            results.push({ categoryId, score });
         }
      }

      return results;
   }

   /**
    * Adds a video ID to the user's seen sorted set with a timestamp score.
    * Automatically prunes videos older than TTL and bounds set size to prevent memory leaks.
    */
   async markVideoAsSeen(userId: string, videoId: string): Promise<void> {
      const client = this.redisService.getClient();
      if (!client) {
         this.logger.warn('Redis client is not available');
         return;
      }

      const key = ANALYZE_CACHE_KEYS.seenVideos(userId);
      const now = Date.now();
      const cutoffTime = now - ANALYZE_CACHE_TTL.SEEN_VIDEOS_SECONDS * 1000;

      const pipeline = client.pipeline();
      // Add video with current epoch timestamp
      pipeline.zadd(key, now, videoId);
      // Prune videos seen more than 3 days ago
      pipeline.zremrangebyscore(key, 0, cutoffTime);
      // Keep at most 1,000 recent seen videos (prune oldest if rank overflows)
      pipeline.zremrangebyrank(key, 0, -1001);
      pipeline.expire(key, ANALYZE_CACHE_TTL.SEEN_VIDEOS_SECONDS);

      await pipeline.exec();
   }

   /**
    * Retrieves recently seen video IDs ordered from newest to oldest.
    */
   async getSeenVideoIds(userId: string, limit = 500): Promise<string[]> {
      const client = this.redisService.getClient();
      if (!client) {
         this.logger.warn('Redis client is not available');
         return [];
      }

      const key = ANALYZE_CACHE_KEYS.seenVideos(userId);
      const safeLimit = Math.max(1, limit);
      // Bounded retrieval from newest to oldest
      return client.zrevrange(key, 0, safeLimit - 1);
   }
}
