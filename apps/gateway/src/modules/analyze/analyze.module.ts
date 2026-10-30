import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { createGrpcRetryChannelOptions, RedisModule } from '@common';
import {
   ANALYZE_V1_GRPC_CLIENT,
   ANALYZE_V1_GRPC_PACKAGE_NAME,
   getAnalyzeProtoLoaderOptions,
   getAnalyzeProtoPath,
} from '@contracts/analyze';
import { GatewayConfigModule, GatewayConfigService } from '@/config';
import { AnalyzeController } from '@/modules/analyze/analyze.controller';
import { AnalyzeService } from '@/modules/analyze/analyze.service';

@Module({
   imports: [
      RedisModule,
      ClientsModule.registerAsync([
         {
            name: ANALYZE_V1_GRPC_CLIENT,
            imports: [GatewayConfigModule],
            inject: [GatewayConfigService],
            useFactory: (configService: GatewayConfigService) => ({
               transport: Transport.GRPC,
               options: {
                  package: [ANALYZE_V1_GRPC_PACKAGE_NAME],
                  protoPath: [getAnalyzeProtoPath()],
                  url: configService.analyzeGrpcUrl,
                  loader: getAnalyzeProtoLoaderOptions(),
                  channelOptions: createGrpcRetryChannelOptions({
                     serviceNames: [ANALYZE_V1_GRPC_PACKAGE_NAME],
                  }),
               },
            }),
         },
      ]),
   ],
   controllers: [AnalyzeController],
   providers: [AnalyzeService],
   exports: [AnalyzeService],
})
export class AnalyzeModule {}
