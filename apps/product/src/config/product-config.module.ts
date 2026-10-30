import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CommonConfigService } from '@common';
import { ProductConfigService } from '@product/config/product-config.service';
import { validateProductEnv } from '@product/config/product-env.schema';

@Global()
@Module({
   imports: [
      ConfigModule.forRoot({
         isGlobal: true,
         validate: validateProductEnv,
         envFilePath: [
            process.env.ENV_FILE || '',
            'apps/product/.env.local',
            'apps/product/.env',
            '.env.local',
            '.env',
         ].filter(Boolean),
      }),
   ],
   providers: [
      ProductConfigService,
      {
         provide: CommonConfigService,
         useExisting: ProductConfigService,
      },
   ],
   exports: [ProductConfigService, CommonConfigService, ConfigModule],
})
export class ProductConfigModule {}
