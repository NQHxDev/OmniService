import '@order/tracing';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AllRpcExceptionsFilter, RmqService, SERVICES, TracingInterceptor } from '@common';
import { ORDER_V1_GRPC_PACKAGE_NAME, getOrderProtoLoaderOptions, getOrderProtoPath } from '@contracts/order';
import { HEALTH_GRPC_PACKAGE_NAME, getHealthProtoPath } from '@contracts/health';
import { OrderModule } from '@order/order.module';
import { OrderConfigService } from '@order/config';

async function bootstrap() {
   const app = await NestFactory.create(OrderModule, {
      bufferLogs: true,
   });
   const logger = app.get(Logger);
   const rmqService = app.get(RmqService);
   const configService = app.get(OrderConfigService);

   app.useLogger(logger);

   app.useGlobalFilters(new AllRpcExceptionsFilter());
   app.useGlobalInterceptors(new TracingInterceptor());

   // Connect RabbitMQ microservice
   app.connectMicroservice(rmqService.getOptions(SERVICES.ORDER_SERVICE), {
      inheritAppConfig: true,
   });

   // Connect gRPC microservice
   app.connectMicroservice<MicroserviceOptions>(
      {
         transport: Transport.GRPC,
         options: {
            package: [ORDER_V1_GRPC_PACKAGE_NAME, HEALTH_GRPC_PACKAGE_NAME],
            protoPath: [getOrderProtoPath(), getHealthProtoPath()],
            url: configService.grpcUrl,
            loader: getOrderProtoLoaderOptions(),
         },
      },
      {
         inheritAppConfig: true,
      },
   );

   await app.startAllMicroservices();

   const port = configService.port;
   await app.listen(port);

   logger.log(`Order Microservice is listening on RabbitMQ queue: ${SERVICES.ORDER_SERVICE}`);
   logger.log(`Order gRPC Microservice is listening on ${configService.grpcUrl}`);
   logger.log(`Order HTTP server is listening on port ${port} (metrics: http://localhost:${port}/metrics)`);
}

void bootstrap();
