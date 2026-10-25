import { Module } from '@nestjs/common';
import { PrismaModule } from '@auth/prisma';
import { OUTBOX_REPOSITORY } from '@auth/outbox/repositories/outbox.repository.interface';
import { OutboxRepository } from '@auth/outbox/repositories/outbox.repository';

@Module({
   imports: [PrismaModule],
   providers: [
      {
         provide: OUTBOX_REPOSITORY,
         useClass: OutboxRepository,
      },
      OutboxRepository,
   ],
   exports: [OUTBOX_REPOSITORY, OutboxRepository],
})
export class OutboxModule {}
