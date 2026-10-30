import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CommonConfigService } from '@common';
import { CommerceConfigService } from '@commerce/config/commerce-config.service';
import { validateCommerceEnv } from '@commerce/config/commerce-env.schema';

@Global()
@Module({
   imports: [
      ConfigModule.forRoot({
         isGlobal: true,
         validate: validateCommerceEnv,
         envFilePath: [
            process.env.ENV_FILE || '',
            'apps/commerce/.env.local',
            'apps/commerce/.env',
            '.env.local',
            '.env',
         ].filter(Boolean),
      }),
   ],
   providers: [
      CommerceConfigService,
      {
         provide: CommonConfigService,
         useExisting: CommerceConfigService,
      },
   ],
   exports: [CommerceConfigService, CommonConfigService, ConfigModule],
})
export class CommerceConfigModule {}
