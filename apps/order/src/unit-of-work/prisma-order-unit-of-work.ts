import { Injectable } from '@nestjs/common';
import { PrismaService } from '@order/prisma/prisma.service';
import { OrderRepository } from '@order/repositories/order.repository';
import type {
   IOrderUnitOfWork,
   IOrderUnitOfWorkRepositories,
   TransactionOptions,
} from '@order/unit-of-work/unit-of-work.interface';

@Injectable()
export class PrismaOrderUnitOfWork implements IOrderUnitOfWork {
   constructor(private readonly prisma: PrismaService) {}

   async runInTransaction<T>(
      work: (repositories: IOrderUnitOfWorkRepositories) => Promise<T>,
      options?: TransactionOptions,
   ): Promise<T> {
      return this.prisma.$transaction(
         async (tx) => {
            const txPrisma = tx as unknown as PrismaService;
            const repositories: IOrderUnitOfWorkRepositories = {
               orderRepository: new OrderRepository(txPrisma),
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
