import '@product/tracing';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AllRpcExceptionsFilter, RmqService, SERVICES, TracingInterceptor } from '@common';
import { PRODUCT_V1_GRPC_PACKAGE_NAME, getProductProtoLoaderOptions, getProductProtoPath } from '@contracts/product';
import { HEALTH_GRPC_PACKAGE_NAME, getHealthProtoPath } from '@contracts/health';
import { ProductModule } from '@product/product.module';
import { ProductConfigService } from '@product/config';

async function bootstrap() {
   const app = await NestFactory.create(ProductModule, {
      bufferLogs: true,
   });
   const logger = app.get(Logger);
   const rmqService = app.get(RmqService);
   const configService = app.get(ProductConfigService);

   app.useLogger(logger);

   app.useGlobalFilters(new AllRpcExceptionsFilter());
   app.useGlobalInterceptors(new TracingInterceptor());

   // Connect RabbitMQ microservice
   app.connectMicroservice(rmqService.getOptions(SERVICES.PRODUCT_SERVICE), {
      inheritAppConfig: true,
   });

   // Connect gRPC microservice
   app.connectMicroservice<MicroserviceOptions>(
      {
         transport: Transport.GRPC,
         options: {
            package: [PRODUCT_V1_GRPC_PACKAGE_NAME, HEALTH_GRPC_PACKAGE_NAME],
            protoPath: [getProductProtoPath(), getHealthProtoPath()],
            url: configService.grpcUrl,
            loader: getProductProtoLoaderOptions(),
         },
      },
      {
         inheritAppConfig: true,
      },
   );

   await app.startAllMicroservices();

   const port = configService.port;
   await app.listen(port);

   logger.log(`Product Microservice is listening on RabbitMQ queue: ${SERVICES.PRODUCT_SERVICE}`);
   logger.log(`Product gRPC Microservice is listening on ${configService.grpcUrl}`);
   logger.log(`Product HTTP server is listening on port ${port} (metrics: http://localhost:${port}/metrics)`);
}

void bootstrap();
