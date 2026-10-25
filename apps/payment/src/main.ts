import '@payment/tracing';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AllRpcExceptionsFilter, RmqService, SERVICES, TracingInterceptor } from '@common';
import { PAYMENT_V1_GRPC_PACKAGE_NAME, getPaymentProtoLoaderOptions, getPaymentProtoPath } from '@contracts/payment';
import { HEALTH_GRPC_PACKAGE_NAME, getHealthProtoPath } from '@contracts/health';
import { PaymentModule } from '@payment/payment.module';
import { PaymentConfigService } from '@payment/config';

async function bootstrap() {
   const app = await NestFactory.create(PaymentModule, {
      bufferLogs: true,
   });
   const logger = app.get(Logger);
   const rmqService = app.get(RmqService);
   const configService = app.get(PaymentConfigService);

   app.useLogger(logger);

   app.useGlobalFilters(new AllRpcExceptionsFilter());
   app.useGlobalInterceptors(new TracingInterceptor());

   // Connect RabbitMQ microservice
   app.connectMicroservice(rmqService.getOptions(SERVICES.PAYMENT_SERVICE), {
      inheritAppConfig: true,
   });

   // Connect gRPC microservice
   app.connectMicroservice<MicroserviceOptions>(
      {
         transport: Transport.GRPC,
         options: {
            package: [PAYMENT_V1_GRPC_PACKAGE_NAME, HEALTH_GRPC_PACKAGE_NAME],
            protoPath: [getPaymentProtoPath(), getHealthProtoPath()],
            url: configService.grpcUrl,
            loader: getPaymentProtoLoaderOptions(),
         },
      },
      {
         inheritAppConfig: true,
      },
   );

   await app.startAllMicroservices();

   const port = configService.port;
   await app.listen(port);

   logger.log(`Payment Microservice is listening on RabbitMQ queue: ${SERVICES.PAYMENT_SERVICE}`);
   logger.log(`Payment gRPC Microservice is listening on ${configService.grpcUrl}`);
   logger.log(`Payment HTTP server is listening on port ${port} (metrics: http://localhost:${port}/metrics)`);
}

void bootstrap();
