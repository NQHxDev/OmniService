import { Injectable } from '@nestjs/common';
import { PrismaService } from '@product/prisma';
import { WhoCategoryEntity } from '@product/entities';
import { WHO_FOOD_GROUPS } from '@contracts/product';
import type { IWhoCategoryRepository } from './who-category.repository.interface';

@Injectable()
export class WhoCategoryRepository implements IWhoCategoryRepository {
   constructor(private readonly prisma: PrismaService) {}

   async findAll(): Promise<WhoCategoryEntity[]> {
      const categories = await this.prisma.whoCategory.findMany({
         orderBy: { order: 'asc' },
      });

      if (!categories || categories.length === 0) {
         return WHO_FOOD_GROUPS.map((g) => ({
            code: g.code,
            name: g.name,
            description: g.description,
            examples: g.examples,
            order: g.order,
            createdAt: new Date(),
            updatedAt: new Date(),
         }));
      }

      return categories;
   }

   async findByCode(code: string): Promise<WhoCategoryEntity | null> {
      const category = await this.prisma.whoCategory.findUnique({
         where: { code },
      });

      if (!category) {
         const fallback = WHO_FOOD_GROUPS.find((g) => g.code === code);
         if (fallback) {
            return {
               code: fallback.code,
               name: fallback.name,
               description: fallback.description,
               examples: fallback.examples,
               order: fallback.order,
               createdAt: new Date(),
               updatedAt: new Date(),
            };
         }
      }

      return category || null;
   }
}
