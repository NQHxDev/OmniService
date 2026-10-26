import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '@common';
import { POST_SEARCH_CONSTANTS } from '@search/domains/post-search/post-search.constants';

export interface PostCounters {
   likes: number;
   views: number;
   comments: number;
   shares: number;
   saves: number;
}

export type PostCounterField = keyof PostCounters;

export const DEFAULT_POST_COUNTERS: PostCounters = {
   likes: 0,
   views: 0,
   comments: 0,
   shares: 0,
   saves: 0,
};

@Injectable()
export class PostCounterService {
   private readonly logger = new Logger(PostCounterService.name);

   constructor(private readonly redisService: RedisService) {}

   private buildKey(postId: string): string {
      return POST_SEARCH_CONSTANTS.COUNTERS.buildKey(postId);
   }

   async getCounters(postId: string): Promise<PostCounters> {
      try {
         const key = this.buildKey(postId);
         const raw = await this.redisService.hgetall(key);
         return this.parseCounters(raw);
      } catch (error) {
         this.logger.warn(`Failed to get counters for post ${postId}: ${(error as Error).message}`);
         return { ...DEFAULT_POST_COUNTERS };
      }
   }

   async getMultiCounters(postIds: string[]): Promise<Map<string, PostCounters>> {
      const result = new Map<string, PostCounters>();
      if (!postIds || postIds.length === 0) {
         return result;
      }

      const client = this.redisService.getClient();
      if (client) {
         try {
            const pipeline = client.pipeline();
            for (const postId of postIds) {
               pipeline.hgetall(this.buildKey(postId));
            }
            const responses = await pipeline.exec();

            if (responses) {
               responses.forEach(([err, rawData], index) => {
                  const postId = postIds[index];
                  if (err || !rawData || typeof rawData !== 'object') {
                     result.set(postId, { ...DEFAULT_POST_COUNTERS });
                  } else {
                     result.set(postId, this.parseCounters(rawData as Record<string, string>));
                  }
               });
               return result;
            }
         } catch (error) {
            this.logger.warn(`Pipeline multi counters failed: ${(error as Error).message}`);
         }
      }

      // Fallback if pipeline fails or client is not directly available
      const counterPromises = postIds.map(async (id) => {
         const counters = await this.getCounters(id);
         result.set(id, counters);
      });
      await Promise.all(counterPromises);

      return result;
   }

   async incrementCounter(postId: string, field: PostCounterField, delta = 1): Promise<number> {
      try {
         const key = this.buildKey(postId);
         return await this.redisService.hincrby(key, field, delta);
      } catch (error) {
         this.logger.warn(`Failed to increment ${field} for post ${postId}: ${(error as Error).message}`);
         return 0;
      }
   }

   async setCounters(postId: string, counters: Partial<PostCounters>): Promise<void> {
      const client = this.redisService.getClient();
      const key = this.buildKey(postId);

      if (client) {
         try {
            const entries: [string, string][] = [];
            if (counters.likes !== undefined) entries.push(['likes', String(counters.likes)]);
            if (counters.views !== undefined) entries.push(['views', String(counters.views)]);
            if (counters.comments !== undefined) entries.push(['comments', String(counters.comments)]);
            if (counters.shares !== undefined) entries.push(['shares', String(counters.shares)]);
            if (counters.saves !== undefined) entries.push(['saves', String(counters.saves)]);

            if (entries.length > 0) {
               await client.hset(key, Object.fromEntries(entries));
            }
            return;
         } catch (error) {
            this.logger.warn(`Client hset counters failed: ${(error as Error).message}`);
         }
      }

      // Fallback via hincrby
      for (const [field, val] of Object.entries(counters)) {
         if (val !== undefined) {
            const current = (await this.getCounters(postId))[field as PostCounterField];
            const diff = Number(val) - current;
            if (diff !== 0) {
               await this.redisService.hincrby(key, field, diff);
            }
         }
      }
   }

   async deleteCounters(postId: string): Promise<void> {
      try {
         const key = this.buildKey(postId);
         await this.redisService.del(key);
      } catch (error) {
         this.logger.warn(`Failed to delete counters for post ${postId}: ${(error as Error).message}`);
      }
   }

   private parseCounters(raw: Record<string, string>): PostCounters {
      return {
         likes: Math.max(0, parseInt(raw.likes, 10) || 0),
         views: Math.max(0, parseInt(raw.views, 10) || 0),
         comments: Math.max(0, parseInt(raw.comments, 10) || 0),
         shares: Math.max(0, parseInt(raw.shares, 10) || 0),
         saves: Math.max(0, parseInt(raw.saves, 10) || 0),
      };
   }
}
