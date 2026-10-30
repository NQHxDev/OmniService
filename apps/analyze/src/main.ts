import '@analyze/tracing';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AllRpcExceptionsFilter, RmqService, SERVICES, TracingInterceptor } from '@common';
import { ANALYZE_V1_GRPC_PACKAGE_NAME, getAnalyzeProtoLoaderOptions, getAnalyzeProtoPath } from '@contracts/analyze';
import { HEALTH_GRPC_PACKAGE_NAME, getHealthProtoPath } from '@contracts/health';
import { AnalyzeModule } from '@analyze/analyze.module';
import { AnalyzeConfigService } from '@analyze/config';

async function bootstrap() {
   const app = await NestFactory.create(AnalyzeModule, {
      bufferLogs: true,
   });
   const logger = app.get(Logger);
   const rmqService = app.get(RmqService);
   const configService = app.get(AnalyzeConfigService);

   app.enableShutdownHooks();
   app.useLogger(logger);

   app.useGlobalFilters(new AllRpcExceptionsFilter());
   app.useGlobalInterceptors(new TracingInterceptor());

   // Connect RabbitMQ microservice queue
   app.connectMicroservice(rmqService.getOptions(SERVICES.ANALYZE_SERVICE), {
      inheritAppConfig: true,
   });

   // Connect gRPC microservice
   app.connectMicroservice<MicroserviceOptions>(
      {
         transport: Transport.GRPC,
         options: {
            package: [ANALYZE_V1_GRPC_PACKAGE_NAME, HEALTH_GRPC_PACKAGE_NAME],
            protoPath: [getAnalyzeProtoPath(), getHealthProtoPath()],
            url: configService.grpcUrl,
            loader: getAnalyzeProtoLoaderOptions(),
         },
      },
      {
         inheritAppConfig: true,
      },
   );

   await app.startAllMicroservices();

   const port = configService.port;
   await app.listen(port);

   logger.log(`Analyze Microservice is listening on RabbitMQ queue: ${SERVICES.ANALYZE_SERVICE}`);
   logger.log(`Analyze gRPC Microservice is listening on ${configService.grpcUrl}`);
   logger.log(`Analyze HTTP server is listening on port ${port}`);
}

void bootstrap();
