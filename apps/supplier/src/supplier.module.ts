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
import { SupplierConfigModule } from '@supplier/config';
import { SupplierLoggerModule } from '@supplier/logger';
import { PrismaModule } from '@supplier/prisma';
import { UnitOfWorkModule } from '@supplier/unit-of-work';
import { OutboxModule } from '@supplier/outbox';
import {
   SUPPLIER_MEMBER_REPOSITORY,
   SUPPLIER_REPOSITORY,
   SupplierMemberRepository,
   SupplierRepository,
} from '@supplier/repositories';
import { SUPPLIER_METRICS_SERVICE, SupplierMetricsService, SupplierService } from '@supplier/services';
import { SUPPLIER_QUERY_HANDLERS } from '@supplier/queries';
import { SUPPLIER_COMMAND_HANDLERS } from '@supplier/commands';
import { SupplierGrpcController, SupplierRmqController } from '@supplier/adapters';
import { SupplierMetricsController } from '@supplier/supplier-metrics.controller';
import { SUPPLIER_EVENT_PUBLISHER, SupplierEventPublisher } from '@supplier/publishers';

@Module({
   imports: [
      EventEmitterModule.forRoot({
         wildcard: true,
         delimiter: '.',
      }),
      SupplierConfigModule,
      SupplierLoggerModule,
      PrismaModule,
      UnitOfWorkModule,
      OutboxModule,
      RedisModule,
      RmqModule,
      RmqModule.register({
         name: SERVICES.AUTH_SERVICE,
      }),
      RmqModule.register({
         name: SERVICES.NOTIFICATION_SERVICE,
      }),
      GrpcHealthModule,
   ],
   controllers: [SupplierGrpcController, SupplierMetricsController, SupplierRmqController],
   providers: [
      // Repositories
      SupplierRepository,
      {
         provide: SUPPLIER_REPOSITORY,
         useExisting: SupplierRepository,
      },
      SupplierMemberRepository,
      {
         provide: SUPPLIER_MEMBER_REPOSITORY,
         useExisting: SupplierMemberRepository,
      },

      // Domain & Application Services
      SupplierService,
      SupplierMetricsService,
      {
         provide: SUPPLIER_METRICS_SERVICE,
         useExisting: SupplierMetricsService,
      },
      {
         provide: GRPC_METRICS_COLLECTOR,
         useExisting: SupplierMetricsService,
      },

      // Interceptors & Guards
      GrpcLoggingInterceptor,
      GrpcMetricsInterceptor,

      // Event Publishers
      SupplierEventPublisher,
      {
         provide: SUPPLIER_EVENT_PUBLISHER,
         useExisting: SupplierEventPublisher,
      },

      // CQRS Command Bus & Handlers
      CommandBus,
      {
         provide: COMMAND_BUS,
         useExisting: CommandBus,
      },
      ...SUPPLIER_QUERY_HANDLERS,
      ...SUPPLIER_COMMAND_HANDLERS,
   ],
   exports: [
      SupplierService,
      SupplierMetricsService,
      SUPPLIER_REPOSITORY,
      SUPPLIER_MEMBER_REPOSITORY,
      SUPPLIER_EVENT_PUBLISHER,
   ],
})
export class SupplierModule implements OnModuleInit {
   constructor(
      private readonly commandBus: CommandBus,
      private readonly moduleRef: ModuleRef,
   ) {}

   onModuleInit(): void {
      const allHandlers = [...SUPPLIER_QUERY_HANDLERS, ...SUPPLIER_COMMAND_HANDLERS];
      for (const handlerClass of allHandlers) {
         const handler = this.moduleRef.get<ICommandHandler<never, never>>(handlerClass, { strict: false });
         if (handler) {
            this.commandBus.registerHandler(handler);
         }
      }
   }
}
