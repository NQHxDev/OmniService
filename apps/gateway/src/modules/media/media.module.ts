import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { createGrpcRetryChannelOptions } from '@common';
import {
   MEDIA_V1_GRPC_CLIENT,
   MEDIA_V1_GRPC_PACKAGE_NAME,
   getMediaProtoLoaderOptions,
   getMediaProtoPath,
} from '@contracts/media';
import { GatewayConfigModule, GatewayConfigService } from '@/config';
import { MediaController } from '@gateway/modules/media/media.controller';
import { MediaService } from '@gateway/modules/media/media.service';

@Module({
   imports: [
      ClientsModule.registerAsync([
         {
            name: MEDIA_V1_GRPC_CLIENT,
            imports: [GatewayConfigModule],
            inject: [GatewayConfigService],
            useFactory: (configService: GatewayConfigService) => ({
               transport: Transport.GRPC,
               options: {
                  package: [MEDIA_V1_GRPC_PACKAGE_NAME],
                  protoPath: [getMediaProtoPath()],
                  url: configService.mediaGrpcUrl,
                  loader: getMediaProtoLoaderOptions(),
                  maxReceiveMessageLength: 50 * 1024 * 1024,
                  maxSendMessageLength: 50 * 1024 * 1024,
                  channelOptions: createGrpcRetryChannelOptions({
                     serviceNames: [MEDIA_V1_GRPC_PACKAGE_NAME],
                     maxReceiveMessageLength: 50 * 1024 * 1024,
                     maxSendMessageLength: 50 * 1024 * 1024,
                  }),
               },
            }),
         },
      ]),
   ],
   controllers: [MediaController],
   providers: [MediaService],
   exports: [MediaService],
})
export class MediaModule {}
