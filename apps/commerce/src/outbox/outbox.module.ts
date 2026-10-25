import { Module } from '@nestjs/common';
import { PrismaModule } from '@commerce/prisma';
import { OutboxService } from '@commerce/outbox/outbox.service';

@Module({
   imports: [PrismaModule],
   providers: [OutboxService],
   exports: [OutboxService],
})
export class OutboxModule {}
