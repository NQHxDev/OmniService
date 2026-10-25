import { Injectable, OnModuleInit, Optional } from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter, Histogram } from 'prom-client';
import { AppLogger } from '@common';
import { BULK_OPERATIONS, SEARCH_INDICES } from '@contracts/search';
import { ElasticsearchService } from '@search/core/elasticsearch';
import {
   METRIC_STATUS,
   SEARCH_INDEXING_COUNTER,
   SEARCH_QUERY_COUNTER,
   SEARCH_QUERY_DURATION,
} from '@search/core/metrics';
import { IngredientStatusEnum } from '@contracts/commerce';

export interface IngredientDocument {
   ingredientId: string;
   ingredientName: string;
   normalizedName: string;
   ingredientSlug: string;
   ingredientDescription: string;
   ingredientImageUrl: string;
   categoryId: string;
   categoryName: string;
   defaultUnit: string;
   ingredientStatus: string;
   supplierCount: number;
   minPrice: number;
   maxPrice: number;
   currency: string;
   createdAt: Date;
   updatedAt: Date;
}

export interface SearchIngredientsParams {
   query?: string;
   categoryId?: string;
   limit?: number;
   offset?: number;
}

export interface SearchIngredientsResult {
   items: IngredientDocument[];
   total: number;
   limit: number;
   offset: number;
}

@Injectable()
export class IngredientSearchService implements OnModuleInit {
   private readonly INDEX_NAME = SEARCH_INDICES.INGREDIENTS;

   constructor(
      private readonly elasticsearchService: ElasticsearchService,
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
      this.logger.setContext(IngredientSearchService.name);
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
            this.logger.log(`Creating Elasticsearch index: ${this.INDEX_NAME}`);
            await client.indices.create({
               index: this.INDEX_NAME,
               body: {
                  mappings: {
                     properties: {
                        ingredientId: { type: 'keyword' },
                        ingredientName: {
                           type: 'text',
                           fields: {
                              keyword: { type: 'keyword', normalizer: 'lowercase' },
                           },
                        },
                        normalizedName: {
                           type: 'text',
                           fields: {
                              keyword: { type: 'keyword', normalizer: 'lowercase' },
                           },
                        },
                        ingredientSlug: { type: 'keyword' },
                        ingredientDescription: { type: 'text' },
                        ingredientImageUrl: { type: 'keyword' },
                        categoryId: { type: 'keyword' },
                        categoryName: {
                           type: 'text',
                           fields: {
                              keyword: { type: 'keyword' },
                           },
                        },
                        defaultUnit: { type: 'keyword' },
                        ingredientStatus: { type: 'keyword' },
                        supplierCount: { type: 'integer' },
                        minPrice: { type: 'double' },
                        maxPrice: { type: 'double' },
                        currency: { type: 'keyword' },
                        createdAt: { type: 'date' },
                        updatedAt: { type: 'date' },
                     },
                  },
                  settings: {
                     analysis: {
                        normalizer: {
                           lowercase: {
                              type: 'custom',
                              char_filter: [],
                              filter: ['lowercase'],
                           },
                        },
                     },
                  },
               },
            });
            this.logger.log(`Created Elasticsearch index: ${this.INDEX_NAME}`);
         }
      } catch (error) {
         this.logger.error(
            `Failed to create index ${this.INDEX_NAME}: ${(error as Error).message}`,
            error instanceof Error ? error.stack : undefined,
         );
      }
   }

   async indexIngredient(ingredient: IngredientDocument): Promise<void> {
      try {
         const client = this.elasticsearchService.getClient();
         await client.index({
            index: this.INDEX_NAME,
            id: ingredient.ingredientId,
            document: {
               ...ingredient,
               updatedAt: ingredient.updatedAt ?? new Date(),
            },
         });
         this.indexingCounter?.inc({
            index: this.INDEX_NAME,
            operation: BULK_OPERATIONS.INDEX,
            status: METRIC_STATUS.SUCCESS,
         });
         this.logger.debug(`Indexed ingredient: ${ingredient.ingredientName} (${ingredient.ingredientId})`);
      } catch (error) {
         this.indexingCounter?.inc({
            index: this.INDEX_NAME,
            operation: BULK_OPERATIONS.INDEX,
            status: METRIC_STATUS.ERROR,
         });
         this.logger.error(
            `Failed to index ingredient ${ingredient.ingredientId}`,
            error instanceof Error ? error.stack : undefined,
         );
         throw error;
      }
   }

   async updateIngredient(ingredientId: string, partial: Partial<IngredientDocument>): Promise<void> {
      try {
         const client = this.elasticsearchService.getClient();
         await client.update({
            index: this.INDEX_NAME,
            id: ingredientId,
            doc: {
               ...partial,
               updatedAt: new Date(),
            },
         });
         this.indexingCounter?.inc({
            index: this.INDEX_NAME,
            operation: BULK_OPERATIONS.UPDATE,
            status: METRIC_STATUS.SUCCESS,
         });
         this.logger.debug(`Updated ingredient in index: ${ingredientId}`);
      } catch (error) {
         this.indexingCounter?.inc({
            index: this.INDEX_NAME,
            operation: BULK_OPERATIONS.UPDATE,
            status: METRIC_STATUS.ERROR,
         });
         this.logger.error(
            `Failed to update ingredient in index: ${ingredientId}`,
            error instanceof Error ? error.stack : undefined,
         );
         throw error;
      }
   }

   async deleteIngredient(ingredientId: string): Promise<void> {
      try {
         const client = this.elasticsearchService.getClient();
         await client.delete({
            index: this.INDEX_NAME,
            id: ingredientId,
         });
         this.indexingCounter?.inc({
            index: this.INDEX_NAME,
            operation: BULK_OPERATIONS.DELETE,
            status: METRIC_STATUS.SUCCESS,
         });
         this.logger.debug(`Deleted ingredient from index: ${ingredientId}`);
      } catch (error) {
         this.indexingCounter?.inc({
            index: this.INDEX_NAME,
            operation: BULK_OPERATIONS.DELETE,
            status: METRIC_STATUS.ERROR,
         });
         this.logger.error(
            `Failed to delete ingredient from index: ${ingredientId}`,
            error instanceof Error ? error.stack : undefined,
         );
         throw error;
      }
   }

   async searchIngredients(params: SearchIngredientsParams): Promise<SearchIngredientsResult> {
      const cleanQuery = params.query ? params.query.trim() : '';
      const limit = params.limit ?? 20;
      const offset = params.offset ?? 0;

      const timer = this.queryDuration?.startTimer({ index: this.INDEX_NAME });

      try {
         const client = this.elasticsearchService.getClient();

         const mustClauses: Record<string, unknown>[] = [];
         const filterClauses: Record<string, unknown>[] = [{ term: { ingredientStatus: IngredientStatusEnum.ACTIVE } }];

         if (params.categoryId) {
            filterClauses.push({ term: { categoryId: params.categoryId } });
         }

         if (cleanQuery) {
            const lowerQuery = cleanQuery.toLowerCase();
            mustClauses.push({
               bool: {
                  should: [
                     {
                        term: {
                           'ingredientName.keyword': {
                              value: lowerQuery,
                              boost: 10,
                           },
                        },
                     },
                     {
                        match_phrase_prefix: {
                           ingredientName: {
                              query: cleanQuery,
                              boost: 6,
                           },
                        },
                     },
                     {
                        match: {
                           ingredientName: {
                              query: cleanQuery,
                              fuzziness: 'AUTO',
                              boost: 3,
                           },
                        },
                     },
                     {
                        match: {
                           normalizedName: {
                              query: cleanQuery,
                              boost: 2,
                           },
                        },
                     },
                     {
                        match: {
                           ingredientDescription: {
                              query: cleanQuery,
                              boost: 1,
                           },
                        },
                     },
                  ],
                  minimum_should_match: 1,
               },
            });
         } else {
            mustClauses.push({ match_all: {} });
         }

         const response = await client.search<IngredientDocument>({
            index: this.INDEX_NAME,
            from: offset,
            size: limit,
            body: {
               query: {
                  bool: {
                     must: mustClauses,
                     filter: filterClauses,
                  },
               },
               sort: cleanQuery
                  ? [{ _score: { order: 'desc' } }, { supplierCount: { order: 'desc' } }]
                  : [{ supplierCount: { order: 'desc' } }, { createdAt: { order: 'desc' } }],
            },
         });

         const hits = response.hits.hits;
         const total =
            typeof response.hits.total === 'number' ? response.hits.total : (response.hits.total?.value ?? hits.length);

         const items = hits.map((hit) => hit._source).filter((doc): doc is IngredientDocument => doc !== undefined);

         this.queryCounter?.inc({ index: this.INDEX_NAME, status: METRIC_STATUS.SUCCESS });
         return {
            items,
            total,
            limit,
            offset,
         };
      } catch (error) {
         this.queryCounter?.inc({ index: this.INDEX_NAME, status: METRIC_STATUS.ERROR });
         this.logger.error(
            `Error executing ingredient search: ${(error as Error).message}`,
            error instanceof Error ? error.stack : undefined,
         );
         throw error;
      } finally {
         timer?.();
      }
   }
}
