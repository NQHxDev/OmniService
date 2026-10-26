import { Injectable } from '@nestjs/common';
import { PrismaService } from '@product/prisma';
import { StockMovementEntity } from '@product/entities';
import type { CreateStockMovementInput, IStockMovementRepository } from './stock-movement.repository.interface';

@Injectable()
export class StockMovementRepository implements IStockMovementRepository {
   constructor(private readonly prisma: PrismaService) {}

   async create(input: CreateStockMovementInput): Promise<StockMovementEntity> {
      const created = await this.prisma.stockMovement.create({
         data: {
            variantId: input.variantId,
            movementType: input.movementType,
            quantity: input.quantity,
            balanceAfter: input.balanceAfter,
            referenceType: input.referenceType,
            referenceId: input.referenceId,
            reason: input.reason,
         },
      });
      return created;
   }

   async findByVariantId(variantId: string, limit = 50): Promise<StockMovementEntity[]> {
      const movements = await this.prisma.stockMovement.findMany({
         where: { variantId },
         orderBy: { createdAt: 'desc' },
         take: limit,
      });
      return movements;
   }
}
