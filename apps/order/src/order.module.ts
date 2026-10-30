import { Module } from '@nestjs/common';
import {
   GRPC_METRICS_COLLECTOR,
   GrpcHealthModule,
   GrpcLoggingInterceptor,
   GrpcMetricsInterceptor,
   RmqModule,
   SERVICES,
} from '@common';
import { OrderConfigModule } from '@order/config';
import { OrderLoggerModule } from '@order/logger';
import { PrismaModule } from '@order/prisma';
import { UnitOfWorkModule } from '@order/unit-of-work';
import { OrderMetricsService } from '@order/services/order-metrics.service';
import { OrderMetricsController } from '@order/order-metrics.controller';
import { OrderGrpcController } from '@order/adapters/order-grpc.controller';
import { PaymentSagaConsumer } from '@order/saga/payment-saga.consumer';
import { OrderStateMachine } from '@order/services/order-state-machine.service';
import {
   CancelOrderCommandHandler,
   CreateOrderCommandHandler,
   UpdateOrderStatusCommandHandler,
   UpdateSupplierOrderStatusCommandHandler,
} from '@order/commands';
import {
   GetOrderByIdQueryHandler,
   GetProductOrderStatsQueryHandler,
   GetOrdersByUserIdQueryHandler,
   GetSupplierOrderByIdQueryHandler,
   ListSupplierOrdersQueryHandler,
} from '@order/queries';
import { ORDER_REPOSITORY, OrderRepository } from '@order/repositories';

@Module({
   imports: [
      OrderConfigModule,
      OrderLoggerModule,
      PrismaModule,
      UnitOfWorkModule,
      RmqModule.register({ name: SERVICES.ORDER_SERVICE }),
      GrpcHealthModule,
   ],
   controllers: [OrderGrpcController, OrderMetricsController, PaymentSagaConsumer],
   providers: [
      OrderRepository,
      {
         provide: ORDER_REPOSITORY,
         useExisting: OrderRepository,
      },
      OrderMetricsService,
      {
         provide: GRPC_METRICS_COLLECTOR,
         useExisting: OrderMetricsService,
      },
      GrpcLoggingInterceptor,
      GrpcMetricsInterceptor,
      OrderStateMachine,
      CreateOrderCommandHandler,
      CancelOrderCommandHandler,
      UpdateOrderStatusCommandHandler,
      UpdateSupplierOrderStatusCommandHandler,
      GetOrderByIdQueryHandler,
      GetProductOrderStatsQueryHandler,
      GetOrdersByUserIdQueryHandler,
      ListSupplierOrdersQueryHandler,
      GetSupplierOrderByIdQueryHandler,
   ],
   exports: [
      OrderRepository,
      ORDER_REPOSITORY,
      OrderMetricsService,
      OrderStateMachine,
      CreateOrderCommandHandler,
      CancelOrderCommandHandler,
      UpdateOrderStatusCommandHandler,
      UpdateSupplierOrderStatusCommandHandler,
      GetOrderByIdQueryHandler,
      GetProductOrderStatsQueryHandler,
      GetOrdersByUserIdQueryHandler,
      ListSupplierOrdersQueryHandler,
      GetSupplierOrderByIdQueryHandler,
   ],
})
export class OrderModule {}
