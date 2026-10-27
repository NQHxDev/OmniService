import '@notification/tracing';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AllRpcExceptionsFilter, RmqService, SERVICES, TracingInterceptor } from '@common';
import { NotificationModule } from '@notification/notification.module';

async function bootstrap() {
   const appContext = await NestFactory.createApplicationContext(NotificationModule, {
      bufferLogs: true,
   });
   const logger = appContext.get(Logger);
   const rmqService = appContext.get(RmqService);

   await rmqService.setupQueueTopology(SERVICES.NOTIFICATION_SERVICE);
   await appContext.close();

   const app = await NestFactory.createMicroservice(
      NotificationModule,
      rmqService.getOptions(SERVICES.NOTIFICATION_SERVICE),
   );

   app.enableShutdownHooks();
   app.useLogger(logger);
   app.useGlobalFilters(new AllRpcExceptionsFilter());
   app.useGlobalInterceptors(new TracingInterceptor());
   await app.listen();
   logger.log('Notification Microservice is listening on RabbitMQ queue: NOTIFICATION_SERVICE');
}

void bootstrap();
