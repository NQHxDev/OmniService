import '@search/tracing';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { type MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AllRpcExceptionsFilter, RmqService, SERVICES, TracingInterceptor } from '@common';
import { SEARCH_V1_GRPC_PACKAGE_NAME, getSearchProtoLoaderOptions, getSearchProtoPath } from '@contracts/search';
import { SearchModule } from '@search/search.module';
import { SearchConfigService } from '@search/config';

async function bootstrap() {
   const app = await NestFactory.create(SearchModule, {
      bufferLogs: true,
   });
   const logger = app.get(Logger);
   const rmqService = app.get(RmqService);
   const configService = app.get(SearchConfigService);

   app.enableShutdownHooks();
   app.useLogger(logger);
   app.useGlobalFilters(new AllRpcExceptionsFilter());
   app.useGlobalInterceptors(new TracingInterceptor());

   // Initialize RabbitMQ topology (Primary, DLX, DLQ, Delayed Retry Queues)
   await rmqService.setupQueueTopology(SERVICES.SEARCH_SERVICE);

   // Connect RabbitMQ microservice (Async Event indexing)
   app.connectMicroservice(rmqService.getOptions(SERVICES.SEARCH_SERVICE), {
      inheritAppConfig: true,
   });

   // Connect gRPC microservice (Sync High-throughput Search)
   app.connectMicroservice<MicroserviceOptions>(
      {
         transport: Transport.GRPC,
         options: {
            package: [SEARCH_V1_GRPC_PACKAGE_NAME],
            protoPath: [getSearchProtoPath()],
            url: configService.grpcUrl,
            loader: getSearchProtoLoaderOptions(),
         },
      },
      {
         inheritAppConfig: true,
      },
   );

   await app.startAllMicroservices();
   logger.log(`Search Microservice is listening on RabbitMQ queue: ${SERVICES.SEARCH_SERVICE}`);
   logger.log(`Search gRPC Microservice is listening on ${configService.grpcUrl}`);

   const port = configService.httpPort;
   await app.listen(port);
   logger.log(`Search Service HTTP (health checks & metrics) listening on port ${port}`);
}

void bootstrap();
