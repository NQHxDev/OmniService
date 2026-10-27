import { Injectable } from '@nestjs/common';
import { PrismaService } from '@product/prisma';
import { WhoCategoryEntity } from '@product/entities';
import type { IWhoCategoryRepository } from './who-category.repository.interface';

@Injectable()
export class WhoCategoryRepository implements IWhoCategoryRepository {
   constructor(private readonly prisma: PrismaService) {}

   async findAll(): Promise<WhoCategoryEntity[]> {
      return this.prisma.whoCategory.findMany({
         orderBy: { order: 'asc' },
      });
   }

   async findByCode(code: string): Promise<WhoCategoryEntity | null> {
      if (!code || typeof code !== 'string') {
         return null;
      }
      return this.prisma.whoCategory.findUnique({
         where: { code },
      });
   }
}
