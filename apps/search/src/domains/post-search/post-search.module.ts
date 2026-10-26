import { Module } from '@nestjs/common';
import { RedisModule, RmqModule } from '@common';
import { ElasticsearchModule } from '@search/core/elasticsearch';
import { MetricsModule } from '@search/core/metrics';
import { PostProjectionConsumer } from '@search/domains/post-search/post-projection.consumer';
import { PostSearchService } from '@search/domains/post-search/post-search.service';
import { PostCounterService } from '@search/domains/post-search/post-counter.service';

@Module({
   imports: [ElasticsearchModule, MetricsModule, RmqModule, RedisModule],
   controllers: [PostProjectionConsumer],
   providers: [PostSearchService, PostCounterService],
   exports: [PostSearchService, PostCounterService],
})
export class PostSearchModule {}
