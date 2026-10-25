import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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
      }),
   ],
   providers: [OrderConfigService],
   exports: [OrderConfigService],
})
export class OrderConfigModule {}
