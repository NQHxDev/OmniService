import { PrismaClient } from '../src/generated/prisma-client';
import { WHO_FOOD_GROUPS } from '@contracts/product';

const prisma = new PrismaClient();

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
   console.log(`Seeded ${WHO_FOOD_GROUPS.length} WHO categories successfully.`);
}

seed()
   .catch((e) => {
      console.error(e);
      process.exit(1);
   })
   .finally(async () => {
      await prisma.$disconnect();
   });
