import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { createGrpcRetryChannelOptions, RedisModule, RmqModule, SERVICES } from '@common';
import {
   SEARCH_V1_GRPC_CLIENT,
   SEARCH_V1_GRPC_PACKAGE_NAME,
   getSearchProtoLoaderOptions,
   getSearchProtoPath,
} from '@contracts/search';
import { GatewayConfigModule, GatewayConfigService } from '@/config';
import { PostsController } from '@/modules/posts/posts.controller';
import { PostsService } from '@/modules/posts/posts.service';

@Module({
   imports: [
      RmqModule.register({
         name: SERVICES.POST_SERVICE,
      }),
      RedisModule,
      ClientsModule.registerAsync([
         {
            name: SEARCH_V1_GRPC_CLIENT,
            imports: [GatewayConfigModule],
            inject: [GatewayConfigService],
            useFactory: (configService: GatewayConfigService) => ({
               transport: Transport.GRPC,
               options: {
                  package: [SEARCH_V1_GRPC_PACKAGE_NAME],
                  protoPath: [getSearchProtoPath()],
                  url: configService.searchGrpcUrl,
                  loader: getSearchProtoLoaderOptions(),
                  channelOptions: createGrpcRetryChannelOptions({
                     serviceNames: [SEARCH_V1_GRPC_PACKAGE_NAME],
                  }),
               },
            }),
         },
      ]),
   ],
   controllers: [PostsController],
   providers: [PostsService],
   exports: [PostsService],
})
export class PostsModule {}
