import { HttpStatus, Injectable, OnModuleInit, Optional } from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter, Histogram } from 'prom-client';
import { AppLogger, decodeSearchAfterCursor, encodeCursor } from '@common';
import { BULK_OPERATIONS, SEARCH_INDICES } from '@contracts/search';
import { ElasticsearchService } from '@search/core/elasticsearch';
import {
   METRIC_STATUS,
   SEARCH_INDEXING_COUNTER,
   SEARCH_QUERY_COUNTER,
   SEARCH_QUERY_DURATION,
} from '@search/core/metrics';
import { PostCounterService } from '@search/domains/post-search/post-counter.service';
import { POST_SEARCH_CONSTANTS } from '@search/domains/post-search/post-search.constants';

export interface PostAuthorDoc {
   userId: string;
   displayName?: string | null;
   avatarUrl?: string | null;
   isVerified?: boolean;
   followerCount?: number;
}

export interface PostShopDoc {
   shopId: string;
   shopName?: string | null;
   logoUrl?: string | null;
}

export interface PostIngredientDoc {
   ingredientId: string;
   name: string;
   amount: number;
   unit: string;
   group?: string | null;
   sortOrder: number;
}

export interface PostDocument {
   postId: string;
   userId: string;
   title: string;
   caption?: string | null;
   mediaId?: string | null;
   videoUrl: string;
   playbackUrl?: string | null;
   thumbnailUrl: string;
   blurHash?: string | null;
   duration: number;
   videoWidth?: number | null;
   videoHeight?: number | null;
   allowComments: boolean;
   allowDuet: boolean;
   createdAt: Date | string;
   updatedAt: Date | string;
   author: PostAuthorDoc;
   shop?: PostShopDoc | null;
   ingredients: PostIngredientDoc[];
   tags?: string[];
   category?: string | null;
}

export interface HydratedPostHit extends PostDocument {
   likeCount: number;
   viewCount: number;
   commentCount: number;
   shareCount: number;
   saveCount: number;
}

interface SearchHit {
   _source: PostDocument;
   sort?: (string | number)[];
}

interface SearchResponse {
   hits: {
      total?: number | { value: number; relation?: string };
      hits: SearchHit[];
   };
}

@Injectable()
export class PostSearchService implements OnModuleInit {
   private readonly INDEX_NAME = SEARCH_INDICES.FEED_POSTS;

   constructor(
      private readonly elasticsearchService: ElasticsearchService,
      private readonly postCounterService: PostCounterService,
      private readonly logger: AppLogger,
      @Optional()
      @InjectMetric(SEARCH_QUERY_COUNTER)
      private readonly queryCounter?: Counter<string>,
      @Optional()
      @InjectMetric(SEARCH_QUERY_DURATION)
      private readonly queryDuration?: Histogram<string>,
      @Optional()
      @InjectMetric(SEARCH_INDEXING_COUNTER)
      private readonly indexingCounter?: Counter<string>,
   ) {
      this.logger.setContext(PostSearchService.name);
   }

   async onModuleInit(): Promise<void> {
      await this.createIndexIfNotExists();
   }

   private async createIndexIfNotExists(): Promise<void> {
      try {
         const client = this.elasticsearchService.getClient();
         const indexExists = await client.indices.exists({
            index: this.INDEX_NAME,
         });

         if (!indexExists) {
            this.logger.log(`Creating Elasticsearch index for CQRS Read-Model: ${this.INDEX_NAME}`);
            await client.indices.create({
               index: this.INDEX_NAME,
               body: {
                  mappings: {
                     properties: {
                        postId: { type: 'keyword' },
                        userId: { type: 'keyword' },
                        title: {
                           type: 'text',
                           fields: {
                              keyword: { type: 'keyword' },
                           },
                        },
                        caption: { type: 'text' },
                        mediaId: { type: 'keyword' },
                        videoUrl: { type: 'keyword' },
                        playbackUrl: { type: 'keyword' },
                        thumbnailUrl: { type: 'keyword' },
                        blurHash: { type: 'keyword' },
                        duration: { type: 'integer' },
                        videoWidth: { type: 'integer' },
                        videoHeight: { type: 'integer' },
                        allowComments: { type: 'boolean' },
                        allowDuet: { type: 'boolean' },
                        createdAt: { type: 'date' },
                        updatedAt: { type: 'date' },
                        tags: { type: 'keyword' },
                        category: { type: 'keyword' },
                        author: {
                           properties: {
                              userId: { type: 'keyword' },
                              displayName: {
                                 type: 'text',
                                 fields: { keyword: { type: 'keyword' } },
                              },
                              avatarUrl: { type: 'keyword' },
                              isVerified: { type: 'boolean' },
                              followerCount: { type: 'integer' },
                           },
                        },
                        shop: {
                           properties: {
                              shopId: { type: 'keyword' },
                              shopName: {
                                 type: 'text',
                                 fields: { keyword: { type: 'keyword' } },
                              },
                              logoUrl: { type: 'keyword' },
                           },
                        },
                        ingredients: {
                           type: 'nested',
                           properties: {
                              ingredientId: { type: 'keyword' },
                              name: {
                                 type: 'text',
                                 fields: { keyword: { type: 'keyword' } },
                              },
                              amount: { type: 'double' },
                              unit: { type: 'keyword' },
                              group: { type: 'keyword' },
                              sortOrder: { type: 'integer' },
                           },
                        },
                     },
                  },
               },
            });
         }
      } catch (error) {
         this.logger.error(
            `Failed to create Elasticsearch index ${this.INDEX_NAME}`,
            error instanceof Error ? error.stack : undefined,
         );
      }
   }

   async getFeed(params: {
      limit?: number;
      cursor?: string;
      userId?: string;
      tag?: string;
      category?: string;
   }): Promise<{ items: HydratedPostHit[]; nextCursor: string | null; hasMore: boolean; total: number }> {
      const limit = params.limit
         ? Math.min(Math.max(Number(params.limit), 1), POST_SEARCH_CONSTANTS.PAGINATION.MAX_FEED_LIMIT)
         : POST_SEARCH_CONSTANTS.PAGINATION.DEFAULT_FEED_LIMIT;
      const timer = this.queryDuration?.startTimer({ index: this.INDEX_NAME });
      const searchAfter = decodeSearchAfterCursor(params.cursor);

      try {
         const client = this.elasticsearchService.getClient();
         const mustQueries: Record<string, unknown>[] = [];

         if (params.userId) {
            mustQueries.push({ term: { userId: params.userId } });
         }
         if (params.tag) {
            mustQueries.push({ term: { tags: params.tag } });
         }
         if (params.category) {
            mustQueries.push({ term: { category: params.category } });
         }

         const query = mustQueries.length > 0 ? { bool: { must: mustQueries } } : { match_all: {} };
         const fetchSize = limit + 1;

         const result = (await client.search({
            index: this.INDEX_NAME,
            size: fetchSize,
            body: {
               query,
               sort: [{ createdAt: { order: 'desc' } }, { postId: { order: 'asc' } }],
               ...(searchAfter && searchAfter.length > 0 ? { search_after: searchAfter } : {}),
            },
         })) as SearchResponse;

         const totalCount =
            typeof result.hits.total === 'number'
               ? result.hits.total
               : typeof result.hits.total?.value === 'number'
                 ? result.hits.total.value
                 : result.hits.hits.length;

         const hits = result.hits.hits || [];
         const hasMore = hits.length > limit;
         const slicedHits = hasMore ? hits.slice(0, limit) : hits;

         let nextCursor: string | null = null;
         if (hasMore && slicedHits.length > 0) {
            const lastHit = slicedHits[slicedHits.length - 1];
            if (lastHit?.sort && Array.isArray(lastHit.sort)) {
               nextCursor = encodeCursor(lastHit.sort);
            }
         }

         // Hydrate Dynamic Counters from Redis Hybrid Pattern
         const postIds = slicedHits.map((h) => h._source.postId);
         const countersMap = await this.postCounterService.getMultiCounters(postIds);

         const hydratedItems: HydratedPostHit[] = slicedHits.map((h) => {
            const doc = h._source;
            const counters = countersMap.get(doc.postId) || {
               likes: 0,
               views: 0,
               comments: 0,
               shares: 0,
               saves: 0,
            };

            return {
               ...doc,
               likeCount: counters.likes,
               viewCount: counters.views,
               commentCount: counters.comments,
               shareCount: counters.shares,
               saveCount: counters.saves,
            };
         });

         this.queryCounter?.inc({ index: this.INDEX_NAME, status: METRIC_STATUS.SUCCESS });
         timer?.({ status: METRIC_STATUS.SUCCESS });

         return {
            items: hydratedItems,
            nextCursor,
            hasMore,
            total: totalCount,
         };
      } catch (error) {
         this.queryCounter?.inc({ index: this.INDEX_NAME, status: METRIC_STATUS.ERROR });
         timer?.({ status: METRIC_STATUS.ERROR });
         this.logger.error(
            'Failed to get post feed from Elasticsearch',
            error instanceof Error ? error.stack : undefined,
         );
         return { items: [], nextCursor: null, hasMore: false, total: 0 };
      }
   }

   async getPostDetail(postId: string): Promise<HydratedPostHit | null> {
      const timer = this.queryDuration?.startTimer({ index: this.INDEX_NAME });
      try {
         const client = this.elasticsearchService.getClient();
         const res = await client.get<PostDocument>({
            index: this.INDEX_NAME,
            id: postId,
         });

         if (!res._source) {
            return null;
         }

         const doc = res._source;
         const counters = await this.postCounterService.getCounters(postId);

         this.queryCounter?.inc({ index: this.INDEX_NAME, status: METRIC_STATUS.SUCCESS });
         timer?.({ status: METRIC_STATUS.SUCCESS });

         return {
            ...doc,
            likeCount: counters.likes,
            viewCount: counters.views,
            commentCount: counters.comments,
            shareCount: counters.shares,
            saveCount: counters.saves,
         };
      } catch (error) {
         this.queryCounter?.inc({ index: this.INDEX_NAME, status: METRIC_STATUS.ERROR });
         timer?.({ status: METRIC_STATUS.ERROR });
         // Elasticsearch 404 response
         const err = error as { statusCode?: number };
         if (err.statusCode === HttpStatus.NOT_FOUND) {
            return null;
         }
         this.logger.error(`Failed to get post detail for ${postId}`, error instanceof Error ? error.stack : undefined);
         return null;
      }
   }

   async indexPost(
      post: PostDocument & {
         likeCount?: number;
         viewCount?: number;
         commentCount?: number;
         shareCount?: number;
         saveCount?: number;
      },
   ): Promise<void> {
      try {
         const client = this.elasticsearchService.getClient();
         const createdAtDate = post.createdAt instanceof Date ? post.createdAt : new Date(post.createdAt);
         const updatedAtDate = post.updatedAt instanceof Date ? post.updatedAt : new Date(post.updatedAt);

         // 1. Index Static / Slow-changing data to Elasticsearch
         await client.index({
            index: this.INDEX_NAME,
            id: post.postId,
            document: {
               postId: post.postId,
               userId: post.userId,
               title: post.title,
               caption: post.caption ?? undefined,
               mediaId: post.mediaId ?? undefined,
               videoUrl: post.videoUrl,
               playbackUrl: post.playbackUrl ?? undefined,
               thumbnailUrl: post.thumbnailUrl,
               blurHash: post.blurHash ?? undefined,
               duration: post.duration,
               videoWidth: post.videoWidth ?? undefined,
               videoHeight: post.videoHeight ?? undefined,
               allowComments: post.allowComments ?? true,
               allowDuet: post.allowDuet ?? false,
               createdAt: createdAtDate,
               updatedAt: updatedAtDate,
               author: post.author,
               shop: post.shop ?? undefined,
               ingredients: post.ingredients ?? [],
               tags: post.tags ?? [],
               category: post.category ?? undefined,
            },
         });

         // 2. Set dynamic counters in Redis if provided
         if (
            post.likeCount !== undefined ||
            post.viewCount !== undefined ||
            post.commentCount !== undefined ||
            post.shareCount !== undefined ||
            post.saveCount !== undefined
         ) {
            await this.postCounterService.setCounters(post.postId, {
               likes: post.likeCount,
               views: post.viewCount,
               comments: post.commentCount,
               shares: post.shareCount,
               saves: post.saveCount,
            });
         }

         this.indexingCounter?.inc({
            index: this.INDEX_NAME,
            operation: BULK_OPERATIONS.INDEX,
            status: METRIC_STATUS.SUCCESS,
         });
         this.logger.debug(`Indexed post projection: ${post.postId}`);
      } catch (error) {
         this.indexingCounter?.inc({
            index: this.INDEX_NAME,
            operation: BULK_OPERATIONS.INDEX,
            status: METRIC_STATUS.ERROR,
         });
         this.logger.error(
            `Failed to index post projection ${post.postId}`,
            error instanceof Error ? error.stack : undefined,
         );
         throw error;
      }
   }

   async updatePost(postId: string, doc: Partial<PostDocument>): Promise<void> {
      try {
         const client = this.elasticsearchService.getClient();
         await client.update({
            index: this.INDEX_NAME,
            id: postId,
            doc: {
               ...doc,
               updatedAt: new Date(),
            },
         });
         this.indexingCounter?.inc({
            index: this.INDEX_NAME,
            operation: BULK_OPERATIONS.UPDATE,
            status: METRIC_STATUS.SUCCESS,
         });
         this.logger.debug(`Updated post projection: ${postId}`);
      } catch (error) {
         this.indexingCounter?.inc({
            index: this.INDEX_NAME,
            operation: BULK_OPERATIONS.UPDATE,
            status: METRIC_STATUS.ERROR,
         });
         this.logger.error(
            `Failed to update post projection ${postId}`,
            error instanceof Error ? error.stack : undefined,
         );
         throw error;
      }
   }

   async deletePost(postId: string): Promise<void> {
      try {
         const client = this.elasticsearchService.getClient();
         await client.delete({
            index: this.INDEX_NAME,
            id: postId,
         });
         await this.postCounterService.deleteCounters(postId);
         this.indexingCounter?.inc({
            index: this.INDEX_NAME,
            operation: BULK_OPERATIONS.DELETE,
            status: METRIC_STATUS.SUCCESS,
         });
         this.logger.debug(`Deleted post projection: ${postId}`);
      } catch (error) {
         this.indexingCounter?.inc({
            index: this.INDEX_NAME,
            operation: BULK_OPERATIONS.DELETE,
            status: METRIC_STATUS.ERROR,
         });
         this.logger.error(
            `Failed to delete post projection ${postId}`,
            error instanceof Error ? error.stack : undefined,
         );
         throw error;
      }
   }

   async updateAuthorProfile(
      userId: string,
      authorData: {
         displayName?: string | null;
         avatarUrl?: string | null;
         isVerified?: boolean;
         followerCount?: number;
      },
   ): Promise<void> {
      try {
         const client = this.elasticsearchService.getClient();
         await client.updateByQuery({
            index: this.INDEX_NAME,
            conflicts: 'proceed',
            body: {
               query: {
                  term: {
                     'author.userId': userId,
                  },
               },
               script: {
                  source: `
                     if (params.displayName != null) { ctx._source.author.displayName = params.displayName; }
                     if (params.avatarUrl != null) { ctx._source.author.avatarUrl = params.avatarUrl; }
                     if (params.isVerified != null) { ctx._source.author.isVerified = params.isVerified; }
                     if (params.followerCount != null) { ctx._source.author.followerCount = params.followerCount; }
                  `,
                  lang: 'painless',
                  params: authorData,
               },
            },
         });
         this.logger.debug(`Updated author profile projection across posts for user ${userId}`);
      } catch (error) {
         this.logger.error(
            `Failed to update author profile for user ${userId} in posts`,
            error instanceof Error ? error.stack : undefined,
         );
      }
   }

   async updateShopInfo(
      shopId: string,
      shopData: {
         shopName?: string | null;
         logoUrl?: string | null;
      },
   ): Promise<void> {
      try {
         const client = this.elasticsearchService.getClient();
         await client.updateByQuery({
            index: this.INDEX_NAME,
            conflicts: 'proceed',
            body: {
               query: {
                  term: {
                     'shop.shopId': shopId,
                  },
               },
               script: {
                  source: `
                     if (ctx._source.shop != null) {
                        if (params.shopName != null) { ctx._source.shop.shopName = params.shopName; }
                        if (params.logoUrl != null) { ctx._source.shop.logoUrl = params.logoUrl; }
                     }
                  `,
                  lang: 'painless',
                  params: shopData,
               },
            },
         });
         this.logger.debug(`Updated shop info projection across posts for shop ${shopId}`);
      } catch (error) {
         this.logger.error(
            `Failed to update shop info for shop ${shopId} in posts`,
            error instanceof Error ? error.stack : undefined,
         );
      }
   }
}
