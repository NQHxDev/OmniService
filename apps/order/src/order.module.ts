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
import { CancelOrderCommandHandler, CreateOrderCommandHandler, UpdateOrderStatusCommandHandler } from '@order/commands';
import { GetOrderByIdQueryHandler, GetOrdersByUserIdQueryHandler } from '@order/queries';

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
      OrderMetricsService,
      {
         provide: GRPC_METRICS_COLLECTOR,
         useExisting: OrderMetricsService,
      },
      GrpcLoggingInterceptor,
      GrpcMetricsInterceptor,
      CreateOrderCommandHandler,
      CancelOrderCommandHandler,
      UpdateOrderStatusCommandHandler,
      GetOrderByIdQueryHandler,
      GetOrdersByUserIdQueryHandler,
   ],
   exports: [
      OrderMetricsService,
      CreateOrderCommandHandler,
      CancelOrderCommandHandler,
      UpdateOrderStatusCommandHandler,
      GetOrderByIdQueryHandler,
      GetOrdersByUserIdQueryHandler,
   ],
})
export class OrderModule {}
