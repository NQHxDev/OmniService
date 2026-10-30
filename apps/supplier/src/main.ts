import '@supplier/tracing';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AllRpcExceptionsFilter, RmqService, SERVICES, TracingInterceptor } from '@common';
import {
   SUPPLIER_V1_GRPC_PACKAGE_NAME,
   getSupplierProtoLoaderOptions,
   getSupplierProtoPath,
} from '@contracts/supplier';
import { HEALTH_GRPC_PACKAGE_NAME, getHealthProtoPath } from '@contracts/health';
import { SupplierModule } from '@supplier/supplier.module';
import { SupplierConfigService } from '@supplier/config';

async function bootstrap() {
   const app = await NestFactory.create(SupplierModule, {
      bufferLogs: true,
   });
   const logger = app.get(Logger);
   const rmqService = app.get(RmqService);
   const configService = app.get(SupplierConfigService);

   app.enableShutdownHooks();
   app.useLogger(logger);

   app.useGlobalFilters(new AllRpcExceptionsFilter());
   app.useGlobalInterceptors(new TracingInterceptor());

   // Connect RabbitMQ microservice
   app.connectMicroservice(rmqService.getOptions(SERVICES.SUPPLIER_SERVICE), {
      inheritAppConfig: true,
   });

   // Connect gRPC microservice
   app.connectMicroservice<MicroserviceOptions>(
      {
         transport: Transport.GRPC,
         options: {
            package: [SUPPLIER_V1_GRPC_PACKAGE_NAME, HEALTH_GRPC_PACKAGE_NAME],
            protoPath: [getSupplierProtoPath(), getHealthProtoPath()],
            url: configService.grpcUrl,
            loader: getSupplierProtoLoaderOptions(),
         },
      },
      {
         inheritAppConfig: true,
      },
   );

   await app.startAllMicroservices();

   const port = configService.port;
   await app.listen(port);

   logger.log(`Supplier Microservice is listening on RabbitMQ queue: ${SERVICES.SUPPLIER_SERVICE}`);
   logger.log(`Supplier gRPC Microservice is listening on ${configService.grpcUrl}`);
   logger.log(`Supplier HTTP server is listening on port ${port} (metrics: http://localhost:${port}/metrics)`);
}

void bootstrap();
