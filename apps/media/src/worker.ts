import '@media/tracing';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AllRpcExceptionsFilter, RmqService, SERVICES, TracingInterceptor } from '@common';
import { MediaModule } from '@media/media.module';
import { MediaConfigService } from '@media/config';

async function bootstrapWorker() {
   process.env.MEDIA_ROLE = 'worker';

   const app = await NestFactory.create(MediaModule, {
      bufferLogs: true,
   });
   const logger = app.get(Logger);
   const rmqService = app.get(RmqService);
   const configService = app.get(MediaConfigService);

   app.useLogger(logger);
   app.useGlobalFilters(new AllRpcExceptionsFilter());
   app.useGlobalInterceptors(new TracingInterceptor());

   // Connect only RabbitMQ microservice with QoS Prefetching=1 for isolated worker execution
   app.connectMicroservice(
      rmqService.getOptions(SERVICES.MEDIA_SERVICE, {
         prefetchCount: configService.transcodePrefetchCount,
         noAck: false,
      }),
      {
         inheritAppConfig: true,
      },
   );

   await app.startAllMicroservices();
   logger.log(
      `Dedicated Media Transcode Worker started successfully. Listening on ${SERVICES.MEDIA_SERVICE} (QoS Prefetch: ${configService.transcodePrefetchCount})`,
   );
}

void bootstrapWorker();
