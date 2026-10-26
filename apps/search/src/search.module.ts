import { Module } from '@nestjs/common';
import { RedisModule, RmqModule } from '@common';
import { SearchConfigModule } from '@search/config';
import { SearchLoggerModule } from '@search/logger';
import { ElasticsearchModule } from '@search/core/elasticsearch';
import { QueueModule } from '@search/core/queue';
import { HealthModule } from '@search/core/health';
import { MetricsModule } from '@search/core/metrics';
import { UserSearchModule } from '@search/domains/user-search';
import { IngredientSearchModule } from '@search/domains/ingredient-search';
import { PostSearchModule } from '@search/domains/post-search';
import { SearchGrpcController } from '@search/adapters/grpc/search-grpc.controller';
import { SearchService } from '@search/search.service';

@Module({
   imports: [
      SearchConfigModule,
      SearchLoggerModule,
      RmqModule,
      RedisModule,
      ElasticsearchModule.forRoot(),
      QueueModule,
      HealthModule,
      MetricsModule,
      UserSearchModule,
      IngredientSearchModule,
      PostSearchModule,
   ],
   controllers: [SearchGrpcController],
   providers: [SearchService],
   exports: [
      SearchService,
      UserSearchModule,
      IngredientSearchModule,
      PostSearchModule,
      QueueModule,
      ElasticsearchModule,
   ],
})
export class SearchModule {}
