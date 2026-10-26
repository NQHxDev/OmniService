import { Module } from '@nestjs/common';
import { PrismaModule } from '@product/prisma';
import { PRODUCT_UNIT_OF_WORK } from '@product/unit-of-work/unit-of-work.interface';
import { PrismaProductUnitOfWork } from '@product/unit-of-work/prisma-unit-of-work';

@Module({
   imports: [PrismaModule],
   providers: [
      PrismaProductUnitOfWork,
      {
         provide: PRODUCT_UNIT_OF_WORK,
         useExisting: PrismaProductUnitOfWork,
      },
   ],
   exports: [PRODUCT_UNIT_OF_WORK, PrismaProductUnitOfWork],
})
export class UnitOfWorkModule {}
