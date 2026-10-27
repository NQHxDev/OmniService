import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { createGrpcRetryChannelOptions } from '@common';
import {
   SUPPLIER_V1_GRPC_CLIENT,
   SUPPLIER_V1_GRPC_PACKAGE_NAME,
   getSupplierProtoLoaderOptions,
   getSupplierProtoPath,
} from '@contracts/supplier';
import { HEALTH_GRPC_PACKAGE_NAME, getHealthProtoPath } from '@contracts/health';
import { GatewayConfigModule, GatewayConfigService } from '@/config';
import { SuppliersController } from '@/modules/suppliers/suppliers.controller';
import { SuppliersService } from '@/modules/suppliers/suppliers.service';
import { VerifiedSupplierGuard } from '@/modules/suppliers/guards';

@Module({
   imports: [
      ClientsModule.registerAsync([
         {
            name: SUPPLIER_V1_GRPC_CLIENT,
            imports: [GatewayConfigModule],
            inject: [GatewayConfigService],
            useFactory: (configService: GatewayConfigService) => ({
               transport: Transport.GRPC,
               options: {
                  package: [SUPPLIER_V1_GRPC_PACKAGE_NAME, HEALTH_GRPC_PACKAGE_NAME],
                  protoPath: [getSupplierProtoPath(), getHealthProtoPath()],
                  url: configService.supplierGrpcUrl,
                  loader: getSupplierProtoLoaderOptions(),
                  channelOptions: createGrpcRetryChannelOptions({
                     serviceNames: [SUPPLIER_V1_GRPC_PACKAGE_NAME],
                  }),
               },
            }),
         },
      ]),
   ],
   controllers: [SuppliersController],
   providers: [SuppliersService, VerifiedSupplierGuard],
   exports: [SuppliersService, VerifiedSupplierGuard],
})
export class SuppliersModule {}
