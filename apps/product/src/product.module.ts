import { Module, type OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import {
   COMMAND_BUS,
   CommandBus,
   GRPC_METRICS_COLLECTOR,
   GrpcHealthModule,
   GrpcLoggingInterceptor,
   GrpcMetricsInterceptor,
   RedisModule,
   RmqModule,
   SERVICES,
   type ICommandHandler,
} from '@common';
import { ProductConfigModule } from '@product/config';
import { ProductLoggerModule } from '@product/logger';
import { PrismaModule } from '@product/prisma';
import { UnitOfWorkModule } from '@product/unit-of-work';
import { OutboxModule } from '@product/outbox';
import {
   PRODUCT_REPOSITORY,
   PRODUCT_VARIANT_REPOSITORY,
   ProductRepository,
   ProductVariantRepository,
   STOCK_MOVEMENT_REPOSITORY,
   StockMovementRepository,
   WHO_CATEGORY_REPOSITORY,
   WhoCategoryRepository,
} from '@product/repositories';
import { PRODUCT_METRICS_SERVICE, ProductMetricsService, ProductService, StockService } from '@product/services';
import { PRODUCT_QUERY_HANDLERS } from '@product/queries';
import { PRODUCT_COMMAND_HANDLERS } from '@product/commands';
import { ProductGrpcController, ProductRmqController } from '@product/adapters';
import { ProductMetricsController } from '@product/product-metrics.controller';
import { PRODUCT_EVENT_PUBLISHER, ProductEventPublisher } from '@product/publishers';

@Module({
   imports: [
      EventEmitterModule.forRoot({
         wildcard: true,
         delimiter: '.',
      }),
      ProductConfigModule,
      ProductLoggerModule,
      PrismaModule,
      UnitOfWorkModule,
      OutboxModule,
      RedisModule,
      RmqModule,
      RmqModule.register({
         name: SERVICES.SEARCH_SERVICE,
      }),
      GrpcHealthModule,
   ],
   controllers: [ProductGrpcController, ProductMetricsController, ProductRmqController],
   providers: [
      // Repositories
      ProductRepository,
      {
         provide: PRODUCT_REPOSITORY,
         useExisting: ProductRepository,
      },
      ProductVariantRepository,
      {
         provide: PRODUCT_VARIANT_REPOSITORY,
         useExisting: ProductVariantRepository,
      },
      WhoCategoryRepository,
      {
         provide: WHO_CATEGORY_REPOSITORY,
         useExisting: WhoCategoryRepository,
      },
      StockMovementRepository,
      {
         provide: STOCK_MOVEMENT_REPOSITORY,
         useExisting: StockMovementRepository,
      },

      // Services
      ProductService,
      StockService,
      ProductMetricsService,
      {
         provide: PRODUCT_METRICS_SERVICE,
         useExisting: ProductMetricsService,
      },
      {
         provide: GRPC_METRICS_COLLECTOR,
         useExisting: ProductMetricsService,
      },

      // Interceptors
      GrpcLoggingInterceptor,
      GrpcMetricsInterceptor,

      // Publisher
      ProductEventPublisher,
      {
         provide: PRODUCT_EVENT_PUBLISHER,
         useExisting: ProductEventPublisher,
      },

      // CQRS
      CommandBus,
      {
         provide: COMMAND_BUS,
         useExisting: CommandBus,
      },
      ...PRODUCT_QUERY_HANDLERS,
      ...PRODUCT_COMMAND_HANDLERS,
   ],
   exports: [
      ProductService,
      StockService,
      ProductMetricsService,
      PRODUCT_REPOSITORY,
      PRODUCT_VARIANT_REPOSITORY,
      WHO_CATEGORY_REPOSITORY,
      STOCK_MOVEMENT_REPOSITORY,
      PRODUCT_EVENT_PUBLISHER,
   ],
})
export class ProductModule implements OnModuleInit {
   constructor(
      private readonly commandBus: CommandBus,
      private readonly moduleRef: ModuleRef,
   ) {}

   onModuleInit(): void {
      const allHandlers = [...PRODUCT_QUERY_HANDLERS, ...PRODUCT_COMMAND_HANDLERS];
      for (const handlerClass of allHandlers) {
         const handler = this.moduleRef.get<ICommandHandler<never, never>>(handlerClass, { strict: false });
         if (handler) {
            this.commandBus.registerHandler(handler);
         }
      }
   }
}
