import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CommonConfigService } from '@common';
import { OrderConfigService } from '@order/config/order-config.service';
import { validateOrderEnv } from '@order/config/order-env.schema';

@Global()
@Module({
   imports: [
      ConfigModule.forRoot({
         isGlobal: true,
         validate: validateOrderEnv,
         validationOptions: {
            abortEarly: false,
         },
         envFilePath: [
            process.env.ENV_FILE || '',
            'apps/order/.env.local',
            'apps/order/.env',
            '.env.local',
            '.env',
         ].filter(Boolean),
      }),
   ],
   providers: [
      OrderConfigService,
      {
         provide: CommonConfigService,
         useExisting: OrderConfigService,
      },
   ],
   exports: [OrderConfigService, CommonConfigService, ConfigModule],
})
export class OrderConfigModule {}
