import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { PrismaClient } from '@media/prisma-client';
import { MediaConfigService, validateMediaEnv } from '@media/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaPoolConfigFactory } from '@common';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
   private readonly logger = new Logger(PrismaService.name);
   private pool?: Pool;

   constructor(@Optional() configService?: MediaConfigService) {
      const url = configService?.databaseUrl || validateMediaEnv(process.env).DATABASE_URL;
      let pool: Pool | undefined;
      let adapter: PrismaPg | undefined;

      if (url) {
         const poolOptions = PrismaPoolConfigFactory.createPoolOptions(url);
         pool = new Pool(poolOptions);
         pool.on('error', (err) => {
            this.logger.error('Unexpected error on idle database client', err);
         });
         adapter = new PrismaPg(pool);
      }

      super(adapter ? { adapter } : undefined);
      this.pool = pool;
   }

   async onModuleInit(): Promise<void> {
      await this.$connect();
   }

   async onModuleDestroy(): Promise<void> {
      await this.$disconnect();
      if (this.pool) {
         await this.pool.end();
      }
   }
}
