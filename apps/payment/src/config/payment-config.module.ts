import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CommonConfigService } from '@common';
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
         envFilePath: [
            process.env.ENV_FILE || '',
            'apps/payment/.env.local',
            'apps/payment/.env',
            '.env.local',
            '.env',
         ].filter(Boolean),
      }),
   ],
   providers: [
      PaymentConfigService,
      {
         provide: CommonConfigService,
         useExisting: PaymentConfigService,
      },
   ],
   exports: [PaymentConfigService, CommonConfigService, ConfigModule],
})
export class PaymentConfigModule {}
