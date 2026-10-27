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

export interface ProductVariantDocument {
   variantId: string;
   sku: string;
   variantName: string;
   unit: string;
   packSize?: string;
   price: number;
   originalPrice?: number;
   currency: string;
   stockQuantity: number;
   lowStockThreshold?: number;
   isDefault: boolean;
   status: string;
}

export interface ProductDocument {
   productId: string;
   supplierId: string;
   whoCategoryCode: string;
   productName: string;
   productSlug: string;
   description: string;
   origin?: string;
   storageCondition?: string;
   shelfLifeDays?: number;
   images: string[];
   status: string;
   moderationStatus: string;
   rejectionReason?: string;
   variants: ProductVariantDocument[];
   minPrice?: number;
   maxPrice?: number;
   currency?: string;
   createdAt: Date | string;
   updatedAt: Date | string;
}

export interface SearchProductsParams {
   query?: string;
   whoCategoryCode?: string;
   supplierId?: string;
   status?: string;
   limit?: number;
   offset?: number;
}

export interface SearchProductsResult {
   items: ProductDocument[];
   total: number;
   limit: number;
   offset: number;
}

export interface ProductSuggestionItem {
   productId: string;
   productName: string;
   productSlug: string;
   whoCategoryCode: string;
   origin?: string;
   images: string[];
   defaultUnit?: string;
   minPrice?: number;
   maxPrice?: number;
   currency?: string;
}

export interface SuggestProductsResult {
   items: ProductSuggestionItem[];
}

@Injectable()
export class ProductSearchService implements OnModuleInit {
   private readonly INDEX_NAME = SEARCH_INDICES.PRODUCTS;

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
      this.logger.setContext(ProductSearchService.name);
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
                        productId: { type: 'keyword' },
                        supplierId: { type: 'keyword' },
                        whoCategoryCode: { type: 'keyword' },
                        productName: {
                           type: 'text',
                           fields: {
                              keyword: { type: 'keyword', normalizer: 'lowercase' },
                              suggest: { type: 'search_as_you_type' },
                           },
                        },
                        productSlug: { type: 'keyword' },
                        description: { type: 'text' },
                        origin: { type: 'keyword' },
                        storageCondition: { type: 'keyword' },
                        shelfLifeDays: { type: 'integer' },
                        images: { type: 'keyword' },
                        status: { type: 'keyword' },
                        moderationStatus: { type: 'keyword' },
                        minPrice: { type: 'double' },
                        maxPrice: { type: 'double' },
                        currency: { type: 'keyword' },
                        variants: {
                           type: 'nested',
                           properties: {
                              variantId: { type: 'keyword' },
                              sku: { type: 'keyword' },
                              variantName: { type: 'text' },
                              unit: { type: 'keyword' },
                              packSize: { type: 'keyword' },
                              price: { type: 'double' },
                              originalPrice: { type: 'double' },
                              currency: { type: 'keyword' },
                              stockQuantity: { type: 'integer' },
                              lowStockThreshold: { type: 'integer' },
                              isDefault: { type: 'boolean' },
                              status: { type: 'keyword' },
                           },
                        },
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

   async indexProduct(product: ProductDocument): Promise<void> {
      try {
         const client = this.elasticsearchService.getClient();
         await client.index({
            index: this.INDEX_NAME,
            id: product.productId,
            document: {
               ...product,
               updatedAt: product.updatedAt ?? new Date(),
            },
         });
         this.indexingCounter?.inc({
            index: this.INDEX_NAME,
            operation: BULK_OPERATIONS.INDEX,
            status: METRIC_STATUS.SUCCESS,
         });
         this.logger.debug(`Indexed product: ${product.productName} (${product.productId})`);
      } catch (error) {
         this.indexingCounter?.inc({
            index: this.INDEX_NAME,
            operation: BULK_OPERATIONS.INDEX,
            status: METRIC_STATUS.ERROR,
         });
         this.logger.error(
            `Failed to index product ${product.productId}`,
            error instanceof Error ? error.stack : undefined,
         );
         throw error;
      }
   }

   async updateProduct(productId: string, partial: Partial<ProductDocument>): Promise<void> {
      try {
         const client = this.elasticsearchService.getClient();
         await client.update({
            index: this.INDEX_NAME,
            id: productId,
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
         this.logger.debug(`Updated product in index: ${productId}`);
      } catch (error) {
         this.indexingCounter?.inc({
            index: this.INDEX_NAME,
            operation: BULK_OPERATIONS.UPDATE,
            status: METRIC_STATUS.ERROR,
         });
         this.logger.error(
            `Failed to update product in index: ${productId}`,
            error instanceof Error ? error.stack : undefined,
         );
         throw error;
      }
   }

   async deleteProduct(productId: string): Promise<void> {
      try {
         const client = this.elasticsearchService.getClient();
         await client.delete({
            index: this.INDEX_NAME,
            id: productId,
         });
         this.indexingCounter?.inc({
            index: this.INDEX_NAME,
            operation: BULK_OPERATIONS.DELETE,
            status: METRIC_STATUS.SUCCESS,
         });
         this.logger.debug(`Deleted product from index: ${productId}`);
      } catch (error) {
         this.indexingCounter?.inc({
            index: this.INDEX_NAME,
            operation: BULK_OPERATIONS.DELETE,
            status: METRIC_STATUS.ERROR,
         });
         this.logger.error(
            `Failed to delete product from index: ${productId}`,
            error instanceof Error ? error.stack : undefined,
         );
         throw error;
      }
   }

   async searchProducts(params: SearchProductsParams): Promise<SearchProductsResult> {
      const cleanQuery = params.query ? params.query.trim() : '';
      const limit = params.limit ?? 20;
      const offset = params.offset ?? 0;

      const timer = this.queryDuration?.startTimer({ index: this.INDEX_NAME });

      try {
         const client = this.elasticsearchService.getClient();

         const mustClauses: Record<string, unknown>[] = [];
         const filterClauses: Record<string, unknown>[] = [];

         if (params.whoCategoryCode) {
            filterClauses.push({ term: { whoCategoryCode: params.whoCategoryCode } });
         }

         if (params.supplierId) {
            filterClauses.push({ term: { supplierId: params.supplierId } });
         }

         if (params.status) {
            filterClauses.push({ term: { status: params.status } });
         }

         if (cleanQuery) {
            const lowerQuery = cleanQuery.toLowerCase();
            mustClauses.push({
               bool: {
                  should: [
                     {
                        term: {
                           'productName.keyword': {
                              value: lowerQuery,
                              boost: 10,
                           },
                        },
                     },
                     {
                        match_phrase_prefix: {
                           productName: {
                              query: cleanQuery,
                              boost: 6,
                           },
                        },
                     },
                     {
                        match: {
                           productName: {
                              query: cleanQuery,
                              fuzziness: 'AUTO',
                              boost: 3,
                           },
                        },
                     },
                     {
                        match: {
                           description: {
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

         const response = await client.search<ProductDocument>({
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
                  ? [{ _score: { order: 'desc' } }, { createdAt: { order: 'desc' } }]
                  : [{ createdAt: { order: 'desc' } }],
            },
         });

         const hits = response.hits.hits;
         const total =
            typeof response.hits.total === 'number' ? response.hits.total : (response.hits.total?.value ?? hits.length);

         const items = hits.map((hit) => hit._source).filter((doc): doc is ProductDocument => doc !== undefined);

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
            `Error executing product search: ${(error as Error).message}`,
            error instanceof Error ? error.stack : undefined,
         );
         throw error;
      } finally {
         timer?.();
      }
   }

   async suggestProducts(params: { query: string; limit?: number }): Promise<SuggestProductsResult> {
      const cleanQuery = params.query ? params.query.trim() : '';
      const limit = params.limit ?? 10;

      if (!cleanQuery) {
         return { items: [] };
      }

      const timer = this.queryDuration?.startTimer({ index: this.INDEX_NAME });

      try {
         const client = this.elasticsearchService.getClient();
         const lowerQuery = cleanQuery.toLowerCase();

         const response = await client.search<ProductDocument>({
            index: this.INDEX_NAME,
            size: limit,
            body: {
               query: {
                  bool: {
                     should: [
                        {
                           term: {
                              'productName.keyword': {
                                 value: lowerQuery,
                                 boost: 10,
                              },
                           },
                        },
                        {
                           match_phrase_prefix: {
                              productName: {
                                 query: cleanQuery,
                                 boost: 6,
                              },
                           },
                        },
                        {
                           multi_match: {
                              query: cleanQuery,
                              type: 'bool_prefix',
                              fields: [
                                 'productName.suggest',
                                 'productName.suggest._2gram',
                                 'productName.suggest._3gram',
                              ],
                              boost: 4,
                           },
                        },
                        {
                           prefix: {
                              'productName.keyword': {
                                 value: lowerQuery,
                                 boost: 2,
                              },
                           },
                        },
                     ],
                     minimum_should_match: 1,
                  },
               },
            },
         });

         const hits = response.hits.hits;
         const items: ProductSuggestionItem[] = hits
            .map((hit) => hit._source)
            .filter((doc): doc is ProductDocument => doc !== undefined)
            .map((doc) => {
               const defaultVariant = doc.variants?.find((v) => v.isDefault) || doc.variants?.[0];
               return {
                  productId: doc.productId,
                  productName: doc.productName,
                  productSlug: doc.productSlug,
                  whoCategoryCode: doc.whoCategoryCode,
                  origin: doc.origin,
                  images: doc.images || [],
                  defaultUnit: defaultVariant?.unit,
                  minPrice: doc.minPrice ?? defaultVariant?.price,
                  maxPrice: doc.maxPrice ?? defaultVariant?.price,
                  currency: doc.currency ?? defaultVariant?.currency,
               };
            });

         this.queryCounter?.inc({ index: this.INDEX_NAME, status: METRIC_STATUS.SUCCESS });
         return { items };
      } catch (error) {
         this.queryCounter?.inc({ index: this.INDEX_NAME, status: METRIC_STATUS.ERROR });
         this.logger.error(
            `Error executing product suggestions: ${(error as Error).message}`,
            error instanceof Error ? error.stack : undefined,
         );
         throw error;
      } finally {
         timer?.();
      }
   }
}
