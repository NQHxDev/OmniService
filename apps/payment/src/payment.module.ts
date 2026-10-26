import { Module } from '@nestjs/common';
import {
   GRPC_METRICS_COLLECTOR,
   GrpcHealthModule,
   GrpcLoggingInterceptor,
   GrpcMetricsInterceptor,
   RmqModule,
   SERVICES,
} from '@common';
import { PaymentConfigModule } from '@payment/config';
import { PaymentLoggerModule } from '@payment/logger';
import { PrismaModule } from '@payment/prisma';
import { PaymentMetricsService } from '@payment/services/payment-metrics.service';
import { PaymentMetricsController } from '@payment/payment-metrics.controller';
import { PaymentGrpcController } from '@payment/adapters/payment-grpc.controller';
import {
   CodPaymentProvider,
   CreditCardPaymentProvider,
   MoMoPaymentProvider,
   PaymentProviderFactory,
   VnPayPaymentProvider,
} from '@payment/providers';
import { PaymentRepository } from '@payment/repositories/payment.repository';
import { PaymentService } from '@payment/services/payment.service';

@Module({
   imports: [
      PaymentConfigModule,
      PaymentLoggerModule,
      PrismaModule,
      RmqModule.register({ name: SERVICES.PAYMENT_SERVICE }),
      RmqModule.register({ name: SERVICES.ORDER_SERVICE }),
      GrpcHealthModule,
   ],
   controllers: [PaymentGrpcController, PaymentMetricsController],
   providers: [
      PaymentMetricsService,
      {
         provide: GRPC_METRICS_COLLECTOR,
         useExisting: PaymentMetricsService,
      },
      GrpcLoggingInterceptor,
      GrpcMetricsInterceptor,
      CodPaymentProvider,
      VnPayPaymentProvider,
      MoMoPaymentProvider,
      CreditCardPaymentProvider,
      PaymentProviderFactory,
      PaymentRepository,
      PaymentService,
   ],
   exports: [PaymentMetricsService, PaymentService, PaymentRepository],
})
export class PaymentModule {}
