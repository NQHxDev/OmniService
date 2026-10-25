import type { Prisma } from '@order/prisma-client';
import type { IOrderRepository } from '@order/repositories';

export const ORDER_UNIT_OF_WORK = Symbol('ORDER_UNIT_OF_WORK');

export interface IOrderUnitOfWorkRepositories {
   readonly orderRepository: IOrderRepository;
}

export interface TransactionOptions {
   isolationLevel?: Prisma.TransactionIsolationLevel;
   maxWait?: number;
   timeout?: number;
}

export interface IOrderUnitOfWork {
   runInTransaction<T>(
      work: (repositories: IOrderUnitOfWorkRepositories) => Promise<T>,
      options?: TransactionOptions,
   ): Promise<T>;
}
