import '@user/tracing';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AllRpcExceptionsFilter, RmqService, SERVICES, TracingInterceptor } from '@common';
import { USER_V1_GRPC_PACKAGE_NAME, getUserProtoLoaderOptions, getUserProtoPath } from '@contracts/user';
import { HEALTH_GRPC_PACKAGE_NAME, getHealthProtoPath } from '@contracts/health';
import { UserModule } from '@user/user.module';
import { UserConfigService } from '@user/config';

async function bootstrap() {
   const app = await NestFactory.create(UserModule, {
      bufferLogs: true,
   });
   const logger = app.get(Logger);
   const rmqService = app.get(RmqService);
   const configService = app.get(UserConfigService);

   app.enableShutdownHooks();
   app.useLogger(logger);

   app.useGlobalFilters(new AllRpcExceptionsFilter());
   app.useGlobalInterceptors(new TracingInterceptor());

   // Connect RabbitMQ microservice
   app.connectMicroservice(rmqService.getOptions(SERVICES.USER_SERVICE), {
      inheritAppConfig: true,
   });

   // Connect gRPC microservice
   app.connectMicroservice<MicroserviceOptions>(
      {
         transport: Transport.GRPC,
         options: {
            package: [USER_V1_GRPC_PACKAGE_NAME, HEALTH_GRPC_PACKAGE_NAME],
            protoPath: [getUserProtoPath(), getHealthProtoPath()],
            url: configService.grpcUrl,
            loader: getUserProtoLoaderOptions(),
            maxReceiveMessageLength: 50 * 1024 * 1024,
            maxSendMessageLength: 50 * 1024 * 1024,
            channelOptions: {
               'grpc.max_receive_message_length': 50 * 1024 * 1024,
               'grpc.max_send_message_length': 50 * 1024 * 1024,
            },
         },
      },
      {
         inheritAppConfig: true,
      },
   );

   await app.startAllMicroservices();

   const port = configService.port;
   await app.listen(port);

   logger.log(`User Microservice is listening on RabbitMQ queue: ${SERVICES.USER_SERVICE}`);
   logger.log(`User gRPC Microservice is listening on ${configService.grpcUrl}`);
   logger.log(`User HTTP server is listening on port ${port} (metrics: http://localhost:${port}/metrics)`);
}

void bootstrap();
