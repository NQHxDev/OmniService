import { Injectable } from '@nestjs/common';
import { PrismaService } from '@product/prisma/prisma.service';
import { ProductRepository } from '@product/repositories/product.repository';
import { ProductVariantRepository } from '@product/repositories/product-variant.repository';
import { WhoCategoryRepository } from '@product/repositories/who-category.repository';
import { StockMovementRepository } from '@product/repositories/stock-movement.repository';
import type {
   IProductUnitOfWork,
   IProductUnitOfWorkRepositories,
   TransactionOptions,
} from '@product/unit-of-work/unit-of-work.interface';

@Injectable()
export class PrismaProductUnitOfWork implements IProductUnitOfWork {
   constructor(private readonly prisma: PrismaService) {}

   async runInTransaction<T>(
      work: (repositories: IProductUnitOfWorkRepositories) => Promise<T>,
      options?: TransactionOptions,
   ): Promise<T> {
      return this.prisma.$transaction(
         async (tx) => {
            const txPrisma = tx as unknown as PrismaService;
            const repositories: IProductUnitOfWorkRepositories = {
               productRepository: new ProductRepository(txPrisma),
               productVariantRepository: new ProductVariantRepository(txPrisma),
               whoCategoryRepository: new WhoCategoryRepository(txPrisma),
               stockMovementRepository: new StockMovementRepository(txPrisma),
            };

            return work(repositories);
         },
         {
            isolationLevel: options?.isolationLevel,
            maxWait: options?.maxWait,
            timeout: options?.timeout,
         },
      );
   }
}
