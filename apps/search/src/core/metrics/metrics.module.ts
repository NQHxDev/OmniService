import { Module } from '@nestjs/common';
import { PrometheusModule, makeCounterProvider, makeHistogramProvider } from '@willsoto/nestjs-prometheus';

export const SEARCH_INDEXING_COUNTER = 'search_indexing_total';
export const SEARCH_QUERY_COUNTER = 'search_query_total';
export const SEARCH_QUERY_DURATION = 'search_query_duration_seconds';

export const METRIC_STATUS = {
   SUCCESS: 'success',
   ERROR: 'error',
} as const;

export type MetricStatus = (typeof METRIC_STATUS)[keyof typeof METRIC_STATUS];

@Module({
   imports: [
      PrometheusModule.register({
         path: '/metrics',
         defaultMetrics: {
            enabled: true,
         },
      }),
   ],
   providers: [
      makeCounterProvider({
         name: SEARCH_INDEXING_COUNTER,
         help: 'Total number of documents indexed',
         labelNames: ['index', 'operation', 'status'],
      }),
      makeHistogramProvider({
         name: SEARCH_QUERY_DURATION,
         help: 'Search query duration in seconds',
         labelNames: ['index', 'status'],
         buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
      }),
      makeCounterProvider({
         name: SEARCH_QUERY_COUNTER,
         help: 'Total number of search queries',
         labelNames: ['index', 'status'],
      }),
   ],
   exports: [PrometheusModule],
})
export class MetricsModule {}
