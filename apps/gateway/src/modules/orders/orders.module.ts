import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { createGrpcRetryChannelOptions } from '@common';
import {
   ORDER_V1_GRPC_CLIENT,
   ORDER_V1_GRPC_PACKAGE_NAME,
   getOrderProtoLoaderOptions,
   getOrderProtoPath,
} from '@contracts/order';
import { HEALTH_GRPC_PACKAGE_NAME, getHealthProtoPath } from '@contracts/health';
import { GatewayConfigModule, GatewayConfigService } from '@/config';
import { OrdersController } from '@/modules/orders/orders.controller';
import { OrdersService } from '@/modules/orders/orders.service';

@Module({
   imports: [
      ClientsModule.registerAsync([
         {
            name: ORDER_V1_GRPC_CLIENT,
            imports: [GatewayConfigModule],
            inject: [GatewayConfigService],
            useFactory: (configService: GatewayConfigService) => ({
               transport: Transport.GRPC,
               options: {
                  package: [ORDER_V1_GRPC_PACKAGE_NAME, HEALTH_GRPC_PACKAGE_NAME],
                  protoPath: [getOrderProtoPath(), getHealthProtoPath()],
                  url: configService.orderGrpcUrl,
                  loader: getOrderProtoLoaderOptions(),
                  channelOptions: createGrpcRetryChannelOptions({
                     serviceNames: [ORDER_V1_GRPC_PACKAGE_NAME],
                  }),
               },
            }),
         },
      ]),
   ],
   controllers: [OrdersController],
   providers: [OrdersService],
   exports: [OrdersService],
})
export class OrdersModule {}
