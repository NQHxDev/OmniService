import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { createGrpcRetryChannelOptions } from '@common';
import {
   PAYMENT_V1_GRPC_CLIENT,
   PAYMENT_V1_GRPC_PACKAGE_NAME,
   getPaymentProtoLoaderOptions,
   getPaymentProtoPath,
} from '@contracts/payment';
import { HEALTH_GRPC_PACKAGE_NAME, getHealthProtoPath } from '@contracts/health';
import { GatewayConfigModule, GatewayConfigService } from '@/config';
import { PaymentsController } from '@/modules/payments/payments.controller';
import { PaymentsService } from '@/modules/payments/payments.service';
import { OrdersModule } from '@/modules/orders/orders.module';

@Module({
   imports: [
      OrdersModule,
      ClientsModule.registerAsync([
         {
            name: PAYMENT_V1_GRPC_CLIENT,
            imports: [GatewayConfigModule],
            inject: [GatewayConfigService],
            useFactory: (configService: GatewayConfigService) => ({
               transport: Transport.GRPC,
               options: {
                  package: [PAYMENT_V1_GRPC_PACKAGE_NAME, HEALTH_GRPC_PACKAGE_NAME],
                  protoPath: [getPaymentProtoPath(), getHealthProtoPath()],
                  url: configService.paymentGrpcUrl,
                  loader: getPaymentProtoLoaderOptions(),
                  channelOptions: createGrpcRetryChannelOptions({
                     serviceNames: [PAYMENT_V1_GRPC_PACKAGE_NAME],
                  }),
               },
            }),
         },
      ]),
   ],
   controllers: [PaymentsController],
   providers: [PaymentsService],
   exports: [PaymentsService],
})
export class PaymentsModule {}
