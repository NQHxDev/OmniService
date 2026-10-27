import { Injectable } from '@nestjs/common';
import { uuidv7 } from '@common';
import { PrismaService } from '@product/prisma';
import { ProductModerationHistoryEntity } from '@product/entities';
import type { Prisma } from '@product/prisma-client';
import type {
   CreateProductModerationHistoryInput,
   IProductModerationHistoryRepository,
} from '@product/repositories/product-moderation-history.repository.interface';

@Injectable()
export class ProductModerationHistoryRepository implements IProductModerationHistoryRepository {
   constructor(private readonly prisma: PrismaService) {}

   private mapToEntity(item: Record<string, unknown>): ProductModerationHistoryEntity {
      return {
         historyId: item.historyId as string,
         productId: item.productId as string,
         moderatorId: item.moderatorId as string,
         moderatorEmail: (item.moderatorEmail as string) || null,
         action: item.action as string,
         previousStatus: item.previousStatus as string,
         newStatus: item.newStatus as string,
         rejectionReason: (item.rejectionReason as string) || null,
         moderationNotes: (item.moderationNotes as string) || null,
         snapshot: (item.snapshot as Record<string, unknown>) || null,
         createdAt: item.createdAt as Date,
      };
   }

   async create(input: CreateProductModerationHistoryInput): Promise<ProductModerationHistoryEntity> {
      const created = await this.prisma.productModerationHistory.create({
         data: {
            historyId: input.historyId || uuidv7(),
            productId: input.productId,
            moderatorId: input.moderatorId,
            moderatorEmail: input.moderatorEmail || null,
            action: input.action,
            previousStatus: input.previousStatus,
            newStatus: input.newStatus,
            rejectionReason: input.rejectionReason || null,
            moderationNotes: input.moderationNotes || null,
            snapshot: (input.snapshot as Prisma.InputJsonValue) ?? undefined,
         },
      });

      return this.mapToEntity(created);
   }

   async findByProductId(productId: string): Promise<ProductModerationHistoryEntity[]> {
      const records = await this.prisma.productModerationHistory.findMany({
         where: { productId },
         orderBy: { createdAt: 'desc' },
      });

      return records.map((r) => this.mapToEntity(r as unknown as Record<string, unknown>));
   }
}
