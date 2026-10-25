import { Injectable, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { PrismaClient } from '@payment/prisma-client';
import { PaymentConfigService, validatePaymentEnv } from '@payment/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
   private pool?: Pool;

   constructor(@Optional() configService?: PaymentConfigService) {
      const url = configService?.databaseUrl || validatePaymentEnv(process.env).DATABASE_URL;
      let pool: Pool | undefined;
      let adapter: PrismaPg | undefined;

      if (url) {
         pool = new Pool({ connectionString: url });
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
