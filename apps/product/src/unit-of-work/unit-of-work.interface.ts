import type { Prisma } from '@product/prisma-client';
import type {
   IProductModerationHistoryRepository,
   IProductRepository,
   IProductVariantRepository,
   IStockMovementRepository,
   IWhoCategoryRepository,
} from '@product/repositories';

export const PRODUCT_UNIT_OF_WORK = Symbol('PRODUCT_UNIT_OF_WORK');

export interface IProductUnitOfWorkRepositories {
   readonly productRepository: IProductRepository;
   readonly productVariantRepository: IProductVariantRepository;
   readonly whoCategoryRepository: IWhoCategoryRepository;
   readonly stockMovementRepository: IStockMovementRepository;
   readonly moderationHistoryRepository: IProductModerationHistoryRepository;
}

export interface TransactionOptions {
   isolationLevel?: Prisma.TransactionIsolationLevel;
   maxWait?: number;
   timeout?: number;
}

export interface IProductUnitOfWork {
   runInTransaction<T>(
      work: (repositories: IProductUnitOfWorkRepositories) => Promise<T>,
      options?: TransactionOptions,
   ): Promise<T>;
}
