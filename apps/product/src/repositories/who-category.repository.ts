import { Injectable } from '@nestjs/common';
import { PrismaService } from '@product/prisma';
import { WhoCategoryEntity } from '@product/entities';
import type { IWhoCategoryRepository } from './who-category.repository.interface';

@Injectable()
export class WhoCategoryRepository implements IWhoCategoryRepository {
   constructor(private readonly prisma: PrismaService) {}

   async findAll(): Promise<WhoCategoryEntity[]> {
      const categories = await this.prisma.whoCategory.findMany({
         orderBy: { order: 'asc' },
      });
      return categories;
   }

   async findByCode(code: string): Promise<WhoCategoryEntity | null> {
      const category = await this.prisma.whoCategory.findUnique({
         where: { code },
      });
      return category || null;
   }
}
