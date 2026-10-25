import { Module } from '@nestjs/common';
import { ORDER_UNIT_OF_WORK } from '@order/unit-of-work/unit-of-work.interface';
import { PrismaOrderUnitOfWork } from '@order/unit-of-work/prisma-order-unit-of-work';

@Module({
   providers: [
      {
         provide: ORDER_UNIT_OF_WORK,
         useClass: PrismaOrderUnitOfWork,
      },
   ],
   exports: [ORDER_UNIT_OF_WORK],
})
export class UnitOfWorkModule {}
