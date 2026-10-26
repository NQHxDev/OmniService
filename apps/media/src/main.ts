import '@media/tracing';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { type MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AllRpcExceptionsFilter, RmqService, SERVICES, TracingInterceptor } from '@common';
import { MEDIA_V1_GRPC_PACKAGE_NAME, getMediaProtoLoaderOptions, getMediaProtoPath } from '@contracts/media';
import { MediaModule } from '@media/media.module';
import { MediaConfigService } from '@media/config';

async function bootstrap() {
   const app = await NestFactory.create(MediaModule, {
      bufferLogs: true,
   });
   const logger = app.get(Logger);
   const rmqService = app.get(RmqService);
   const configService = app.get(MediaConfigService);

   app.useLogger(logger);
   app.useGlobalFilters(new AllRpcExceptionsFilter());
   app.useGlobalInterceptors(new TracingInterceptor());

   // Connect RabbitMQ microservice with QoS Prefetching backpressure
   if (configService.isWorkerRole) {
      app.connectMicroservice(
         rmqService.getOptions(SERVICES.MEDIA_SERVICE, {
            prefetchCount: configService.transcodePrefetchCount,
            noAck: false,
         }),
         {
            inheritAppConfig: true,
         },
      );
   }

   // Connect gRPC microservice
   if (configService.isApiRole) {
      app.connectMicroservice<MicroserviceOptions>(
         {
            transport: Transport.GRPC,
            options: {
               package: [MEDIA_V1_GRPC_PACKAGE_NAME],
               protoPath: [getMediaProtoPath()],
               url: configService.grpcUrl,
               loader: getMediaProtoLoaderOptions(),
            },
         },
         {
            inheritAppConfig: true,
         },
      );
   }

   await app.startAllMicroservices();
   if (configService.isWorkerRole) {
      logger.log(
         `Media Worker is listening on RabbitMQ queue: ${SERVICES.MEDIA_SERVICE} (prefetch: ${configService.transcodePrefetchCount})`,
      );
   }
   if (configService.isApiRole) {
      logger.log(`Media gRPC Microservice is listening on ${configService.grpcUrl}`);
   }
}

void bootstrap();
