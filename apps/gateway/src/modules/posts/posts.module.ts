import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { createGrpcRetryChannelOptions, RedisModule } from '@common';
import {
   POST_V1_GRPC_CLIENT,
   POST_V1_GRPC_PACKAGE_NAME,
   getPostProtoLoaderOptions,
   getPostProtoPath,
} from '@contracts/post';
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
      RedisModule,
      ClientsModule.registerAsync([
         {
            name: POST_V1_GRPC_CLIENT,
            imports: [GatewayConfigModule],
            inject: [GatewayConfigService],
            useFactory: (configService: GatewayConfigService) => ({
               transport: Transport.GRPC,
               options: {
                  package: [POST_V1_GRPC_PACKAGE_NAME],
                  protoPath: [getPostProtoPath()],
                  url: configService.postGrpcUrl,
                  loader: getPostProtoLoaderOptions(),
                  channelOptions: createGrpcRetryChannelOptions({
                     serviceNames: [POST_V1_GRPC_PACKAGE_NAME],
                  }),
               },
            }),
         },
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
