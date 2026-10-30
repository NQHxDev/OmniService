import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CommonConfigService } from '@common';
import { validateAnalyzeEnv } from '@analyze/config/analyze-env.schema';
import { AnalyzeConfigService } from '@analyze/config/analyze-config.service';

@Global()
@Module({
   imports: [
      ConfigModule.forRoot({
         isGlobal: true,
         validate: validateAnalyzeEnv,
         envFilePath: [
            process.env.ENV_FILE || '',
            'apps/analyze/.env.local',
            'apps/analyze/.env',
            '.env.local',
            '.env',
         ].filter(Boolean),
      }),
   ],
   providers: [
      AnalyzeConfigService,
      {
         provide: CommonConfigService,
         useExisting: AnalyzeConfigService,
      },
   ],
   exports: [AnalyzeConfigService, CommonConfigService, ConfigModule],
})
export class AnalyzeConfigModule {}
