import '@post/tracing';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AllRpcExceptionsFilter, RmqService, SERVICES, TracingInterceptor } from '@common';
import { POST_V1_GRPC_PACKAGE_NAME, getPostProtoLoaderOptions, getPostProtoPath } from '@contracts/post';
import { PostModule } from '@post/post.module';
import { PostConfigService } from '@post/config';

async function bootstrap() {
   const app = await NestFactory.create(PostModule, {
      bufferLogs: true,
   });
   const logger = app.get(Logger);
   const rmqService = app.get(RmqService);
   const configService = app.get(PostConfigService);

   app.useLogger(logger);

   app.useGlobalFilters(new AllRpcExceptionsFilter());
   app.useGlobalInterceptors(new TracingInterceptor());

   // Connect RabbitMQ microservice (legacy backward compatibility)
   app.connectMicroservice(rmqService.getOptions(SERVICES.POST_SERVICE), {
      inheritAppConfig: true,
   });

   // Connect gRPC microservice
   app.connectMicroservice<MicroserviceOptions>(
      {
         transport: Transport.GRPC,
         options: {
            package: [POST_V1_GRPC_PACKAGE_NAME],
            protoPath: [getPostProtoPath()],
            url: configService.grpcUrl,
            loader: getPostProtoLoaderOptions(),
         },
      },
      {
         inheritAppConfig: true,
      },
   );

   await app.startAllMicroservices();

   const port = configService.port;
   await app.listen(port);

   logger.log(`Post Microservice is listening on RabbitMQ queue: ${SERVICES.POST_SERVICE}`);
   logger.log(`Post gRPC Microservice is listening on ${configService.grpcUrl}`);
   logger.log(`Post HTTP server is listening on port ${port}`);
}

void bootstrap();
