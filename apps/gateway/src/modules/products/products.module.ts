import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { createGrpcRetryChannelOptions } from '@common';
import {
   PRODUCT_V1_GRPC_CLIENT,
   PRODUCT_V1_GRPC_PACKAGE_NAME,
   getProductProtoLoaderOptions,
   getProductProtoPath,
} from '@contracts/product';
import { HEALTH_GRPC_PACKAGE_NAME, getHealthProtoPath } from '@contracts/health';
import { GatewayConfigModule, GatewayConfigService } from '@/config';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
   imports: [
      ClientsModule.registerAsync([
         {
            name: PRODUCT_V1_GRPC_CLIENT,
            imports: [GatewayConfigModule],
            inject: [GatewayConfigService],
            useFactory: (configService: GatewayConfigService) => ({
               transport: Transport.GRPC,
               options: {
                  package: [PRODUCT_V1_GRPC_PACKAGE_NAME, HEALTH_GRPC_PACKAGE_NAME],
                  protoPath: [getProductProtoPath(), getHealthProtoPath()],
                  url: configService.productGrpcUrl,
                  loader: getProductProtoLoaderOptions(),
                  channelOptions: createGrpcRetryChannelOptions({
                     serviceNames: [PRODUCT_V1_GRPC_PACKAGE_NAME],
                  }),
               },
            }),
         },
      ]),
   ],
   controllers: [ProductsController],
   providers: [ProductsService],
   exports: [ProductsService],
})
export class ProductsModule {}
