import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { AppLogger, createGrpcRetryChannelOptions, RmqModule, SERVICES } from '@common';
import {
   MEDIA_V1_GRPC_CLIENT,
   MEDIA_V1_GRPC_PACKAGE_NAME,
   getMediaProtoLoaderOptions,
   getMediaProtoPath,
} from '@contracts/media';
import {
   SEARCH_V1_GRPC_CLIENT,
   SEARCH_V1_GRPC_PACKAGE_NAME,
   getSearchProtoLoaderOptions,
   getSearchProtoPath,
} from '@contracts/search';
import { UserConfigModule, UserConfigService } from '@user/config';
import { GrpcMediaAdapter, MEDIA_ADAPTER, RabbitMqMediaAdapter } from '@user/adapters/media';
import { GrpcSearchAdapter, SEARCH_ADAPTER, RabbitMqSearchAdapter } from '@user/adapters/search';
import { NOTIFICATION_ADAPTER, RabbitMqNotificationAdapter } from '@user/adapters/notification';
import {
   MetricsMediaAdapterDecorator,
   MetricsNotificationAdapterDecorator,
   MetricsSearchAdapterDecorator,
} from '@user/decorators';
import { USER_METRICS_SERVICE, type IUserMetricsService } from '@user/services/infrastructure/user-metrics.interface';
import { UserMetricsService } from '@user/services/infrastructure/user-metrics.service';

@Module({
   imports: [
      RmqModule.register({
         name: SERVICES.MEDIA_SERVICE,
      }),
      RmqModule.register({
         name: SERVICES.SEARCH_SERVICE,
      }),
      RmqModule.register({
         name: SERVICES.NOTIFICATION_SERVICE,
      }),
      ClientsModule.registerAsync([
         {
            name: MEDIA_V1_GRPC_CLIENT,
            imports: [UserConfigModule],
            inject: [UserConfigService],
            useFactory: (configService: UserConfigService) => ({
               transport: Transport.GRPC,
               options: {
                  package: [MEDIA_V1_GRPC_PACKAGE_NAME],
                  protoPath: [getMediaProtoPath()],
                  url: configService.mediaGrpcUrl,
                  loader: getMediaProtoLoaderOptions(),
                  channelOptions: createGrpcRetryChannelOptions({
                     serviceNames: [MEDIA_V1_GRPC_PACKAGE_NAME],
                  }),
               },
            }),
         },
         {
            name: SEARCH_V1_GRPC_CLIENT,
            imports: [UserConfigModule],
            inject: [UserConfigService],
            useFactory: (configService: UserConfigService) => ({
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
   providers: [
      // Metrics Service
      UserMetricsService,
      {
         provide: USER_METRICS_SERVICE,
         useExisting: UserMetricsService,
      },

      // Base Adapters
      GrpcMediaAdapter,
      RabbitMqMediaAdapter,
      GrpcSearchAdapter,
      RabbitMqSearchAdapter,
      RabbitMqNotificationAdapter,

      // Decorator Pattern Providers
      {
         provide: MEDIA_ADAPTER,
         useFactory: (inner: GrpcMediaAdapter, metrics: IUserMetricsService, logger: AppLogger) =>
            new MetricsMediaAdapterDecorator(inner, metrics, logger),
         inject: [GrpcMediaAdapter, USER_METRICS_SERVICE, AppLogger],
      },
      {
         provide: SEARCH_ADAPTER,
         useFactory: (inner: GrpcSearchAdapter, metrics: IUserMetricsService, logger: AppLogger) =>
            new MetricsSearchAdapterDecorator(inner, metrics, logger),
         inject: [GrpcSearchAdapter, USER_METRICS_SERVICE, AppLogger],
      },
      {
         provide: NOTIFICATION_ADAPTER,
         useFactory: (inner: RabbitMqNotificationAdapter, metrics: IUserMetricsService, logger: AppLogger) =>
            new MetricsNotificationAdapterDecorator(inner, metrics, logger),
         inject: [RabbitMqNotificationAdapter, USER_METRICS_SERVICE, AppLogger],
      },
   ],
   exports: [
      USER_METRICS_SERVICE,
      UserMetricsService,
      MEDIA_ADAPTER,
      SEARCH_ADAPTER,
      NOTIFICATION_ADAPTER,
      GrpcMediaAdapter,
      RabbitMqMediaAdapter,
      GrpcSearchAdapter,
      RabbitMqSearchAdapter,
      RabbitMqNotificationAdapter,
   ],
})
export class UserAdaptersModule {}
