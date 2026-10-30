import { PrismaClient } from '@product/prisma-client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { WHO_FOOD_GROUPS } from '@contracts/product';
import { validateProductEnv } from '@product/config';
import { PrismaPoolConfigFactory } from '@common';

const env = validateProductEnv(process.env);
const connectionString = env.DIRECT_URL || env.DATABASE_URL;
const poolOptions = PrismaPoolConfigFactory.createPoolOptions(connectionString);
const pool = new Pool(poolOptions);
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function seed() {
   console.log('Seeding WHO nutrition categories...');
   for (const group of WHO_FOOD_GROUPS) {
      await prisma.whoCategory.upsert({
         where: { code: group.code },
         update: {
            name: group.name,
            description: group.description,
            examples: group.examples,
            order: group.order,
         },
         create: {
            code: group.code,
            name: group.name,
            description: group.description,
            examples: group.examples,
            order: group.order,
         },
      });
   }
   console.log(`✔ Seeded ${WHO_FOOD_GROUPS.length} WHO categories successfully.`);
}

seed()
   .catch((e) => {
      console.error(e);
      process.exit(1);
   })
   .finally(async () => {
      await prisma.$disconnect();
      await pool.end();
   });
