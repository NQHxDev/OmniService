import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PaymentConfigService } from '@payment/config/payment-config.service';
import { validatePaymentEnv } from '@payment/config/payment-env.schema';

@Global()
@Module({
   imports: [
      ConfigModule.forRoot({
         isGlobal: true,
         validate: validatePaymentEnv,
         validationOptions: {
            abortEarly: false,
         },
      }),
   ],
   providers: [PaymentConfigService],
   exports: [PaymentConfigService],
})
export class PaymentConfigModule {}
