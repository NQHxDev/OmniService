import { Module } from '@nestjs/common';
import { RmqModule } from '@common';
import { ElasticsearchModule } from '@search/core/elasticsearch';
import { QueueModule } from '@search/core/queue';
import { MetricsModule } from '@search/core/metrics';
import { ProductSearchController } from '@search/domains/product-search/product-search.controller';
import { ProductSearchService } from '@search/domains/product-search/product-search.service';

@Module({
   imports: [ElasticsearchModule, QueueModule, MetricsModule, RmqModule],
   controllers: [ProductSearchController],
   providers: [ProductSearchService],
   exports: [ProductSearchService],
})
export class ProductSearchModule {}
