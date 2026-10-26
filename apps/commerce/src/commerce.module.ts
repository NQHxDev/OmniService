import { Module, type OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ClientsModule, Transport } from '@nestjs/microservices';
import {
   COMMAND_BUS,
   CommandBus,
   createGrpcRetryChannelOptions,
   GRPC_METRICS_COLLECTOR,
   GrpcHealthModule,
   GrpcLoggingInterceptor,
   GrpcMetricsInterceptor,
   RedisModule,
   RmqModule,
   SERVICES,
   type ICommandHandler,
} from '@common';
import {
   SUPPLIER_V1_GRPC_CLIENT,
   SUPPLIER_V1_GRPC_PACKAGE_NAME,
   getSupplierProtoLoaderOptions,
   getSupplierProtoPath,
} from '@contracts/supplier';
import { CommerceConfigModule, CommerceConfigService } from '@commerce/config';
import { CommerceLoggerModule } from '@commerce/logger';
import { PrismaModule } from '@commerce/prisma';
import { UnitOfWorkModule } from '@commerce/unit-of-work';
import { OutboxModule } from '@commerce/outbox';
import {
   CATEGORY_REPOSITORY,
   CategoryRepository,
   INGREDIENT_REPOSITORY,
   IngredientRepository,
   SUPPLIER_PRODUCT_REPOSITORY,
   SupplierProductRepository,
} from '@commerce/repositories';
import {
   COMMERCE_METRICS_SERVICE,
   CommerceMetricsService,
   IngredientCatalogService,
   SupplierOfferService,
} from '@commerce/services';
import { COMMERCE_QUERY_HANDLERS } from '@commerce/queries';
import { COMMERCE_COMMAND_HANDLERS } from '@commerce/commands';
import {
   COMMERCE_SEARCH_ADAPTER,
   CommerceGrpcController,
   GrpcSupplierAdapter,
   RabbitMqCommerceSearchAdapter,
   SUPPLIER_ADAPTER,
} from '@commerce/adapters';
import { CommerceMetricsController } from '@commerce/commerce-metrics.controller';

@Module({
   imports: [
      EventEmitterModule.forRoot({
         wildcard: true,
         delimiter: '.',
      }),
      CommerceConfigModule,
      CommerceLoggerModule,
      PrismaModule,
      UnitOfWorkModule,
      OutboxModule,
      RedisModule,
      RmqModule,
      RmqModule.register({
         name: SERVICES.SEARCH_SERVICE,
      }),
      ClientsModule.registerAsync([
         {
            name: SUPPLIER_V1_GRPC_CLIENT,
            imports: [CommerceConfigModule],
            inject: [CommerceConfigService],
            useFactory: (config: CommerceConfigService) => ({
               transport: Transport.GRPC,
               options: {
                  package: [SUPPLIER_V1_GRPC_PACKAGE_NAME],
                  protoPath: [getSupplierProtoPath()],
                  url: config.supplierGrpcUrl,
                  loader: getSupplierProtoLoaderOptions(),
                  channelOptions: createGrpcRetryChannelOptions({
                     serviceNames: [SUPPLIER_V1_GRPC_PACKAGE_NAME],
                  }),
               },
            }),
         },
      ]),
      GrpcHealthModule,
   ],
   controllers: [CommerceGrpcController, CommerceMetricsController],
   providers: [
      // Supplier Adapter (ACL)
      GrpcSupplierAdapter,
      {
         provide: SUPPLIER_ADAPTER,
         useExisting: GrpcSupplierAdapter,
      },

      // Search Adapter
      RabbitMqCommerceSearchAdapter,
      {
         provide: COMMERCE_SEARCH_ADAPTER,
         useExisting: RabbitMqCommerceSearchAdapter,
      },

      // Repositories
      CategoryRepository,
      {
         provide: CATEGORY_REPOSITORY,
         useExisting: CategoryRepository,
      },
      IngredientRepository,
      {
         provide: INGREDIENT_REPOSITORY,
         useExisting: IngredientRepository,
      },
      SupplierProductRepository,
      {
         provide: SUPPLIER_PRODUCT_REPOSITORY,
         useExisting: SupplierProductRepository,
      },

      // Domain & Application Services
      IngredientCatalogService,
      SupplierOfferService,
      CommerceMetricsService,
      {
         provide: COMMERCE_METRICS_SERVICE,
         useExisting: CommerceMetricsService,
      },
      {
         provide: GRPC_METRICS_COLLECTOR,
         useExisting: CommerceMetricsService,
      },

      // Interceptors
      GrpcLoggingInterceptor,
      GrpcMetricsInterceptor,

      // CQRS Command Bus & Handlers
      CommandBus,
      {
         provide: COMMAND_BUS,
         useExisting: CommandBus,
      },
      ...COMMERCE_QUERY_HANDLERS,
      ...COMMERCE_COMMAND_HANDLERS,
   ],
   exports: [
      IngredientCatalogService,
      SupplierOfferService,
      CommerceMetricsService,
      CATEGORY_REPOSITORY,
      INGREDIENT_REPOSITORY,
      SUPPLIER_PRODUCT_REPOSITORY,
      SUPPLIER_ADAPTER,
      COMMERCE_SEARCH_ADAPTER,
      RabbitMqCommerceSearchAdapter,
   ],
})
export class CommerceModule implements OnModuleInit {
   constructor(
      private readonly commandBus: CommandBus,
      private readonly moduleRef: ModuleRef,
   ) {}

   onModuleInit(): void {
      const allHandlers = [...COMMERCE_QUERY_HANDLERS, ...COMMERCE_COMMAND_HANDLERS];
      for (const handlerClass of allHandlers) {
         const handler = this.moduleRef.get<ICommandHandler<never, never>>(handlerClass, { strict: false });
         if (handler) {
            this.commandBus.registerHandler(handler);
         }
      }
   }
}
