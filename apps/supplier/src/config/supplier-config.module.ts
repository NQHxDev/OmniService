import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CommonConfigService } from '@common';
import { SupplierConfigService } from '@supplier/config/supplier-config.service';
import { validateSupplierEnv } from '@supplier/config/supplier-env.schema';

@Global()
@Module({
   imports: [
      ConfigModule.forRoot({
         isGlobal: true,
         validate: validateSupplierEnv,
         envFilePath: [
            process.env.ENV_FILE || '',
            'apps/supplier/.env.local',
            'apps/supplier/.env',
            '.env.local',
            '.env',
         ].filter(Boolean),
      }),
   ],
   providers: [
      SupplierConfigService,
      {
         provide: CommonConfigService,
         useExisting: SupplierConfigService,
      },
   ],
   exports: [SupplierConfigService, CommonConfigService, ConfigModule],
})
export class SupplierConfigModule {}
