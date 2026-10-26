import { Module } from '@nestjs/common';
import { PrismaModule } from '@product/prisma';
import { OutboxService } from '@product/outbox/outbox.service';

@Module({
   imports: [PrismaModule],
   providers: [OutboxService],
   exports: [OutboxService],
})
export class OutboxModule {}
