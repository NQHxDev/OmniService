import '@auth/tracing';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AllRpcExceptionsFilter, RmqService, SERVICES, TracingInterceptor } from '@common';
import { AUTH_V1_GRPC_PACKAGE_NAME, getAuthProtoLoaderOptions, getAuthProtoPath } from '@contracts/auth';
import { HEALTH_GRPC_PACKAGE_NAME, getHealthProtoPath } from '@contracts/health';
import { AuthModule } from '@auth/auth.module';
import { AuthConfigService } from '@auth/config';

async function bootstrap() {
   const app = await NestFactory.create(AuthModule, {
      bufferLogs: true,
   });
   const logger = app.get(Logger);
   const rmqService = app.get(RmqService);
   const configService = app.get(AuthConfigService);

   app.enableShutdownHooks();
   app.useLogger(logger);

   app.useGlobalFilters(new AllRpcExceptionsFilter());
   app.useGlobalInterceptors(new TracingInterceptor());

   // Initialize RabbitMQ topology (Primary, DLX, DLQ, Delayed Retry Queues)
   await rmqService.setupQueueTopology(SERVICES.AUTH_SERVICE);

   // Connect RabbitMQ microservice
   app.connectMicroservice(rmqService.getOptions(SERVICES.AUTH_SERVICE), {
      inheritAppConfig: true,
   });

   // Connect gRPC microservice
   app.connectMicroservice<MicroserviceOptions>(
      {
         transport: Transport.GRPC,
         options: {
            package: [AUTH_V1_GRPC_PACKAGE_NAME, HEALTH_GRPC_PACKAGE_NAME],
            protoPath: [getAuthProtoPath(), getHealthProtoPath()],
            url: configService.grpcUrl,
            loader: getAuthProtoLoaderOptions(),
         },
      },
      {
         inheritAppConfig: true,
      },
   );

   await app.startAllMicroservices();

   const port = configService.port;
   await app.listen(port);

   logger.log(`Auth Microservice is listening on RabbitMQ queue: ${SERVICES.AUTH_SERVICE}`);
   logger.log(`Auth gRPC Microservice is listening on ${configService.grpcUrl}`);
   logger.log(`Auth HTTP server is listening on port ${port} (metrics: http://localhost:${port}/metrics)`);
}

void bootstrap();
