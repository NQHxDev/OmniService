import { Module } from '@nestjs/common';
import { PrismaModule } from '@supplier/prisma';
import { OutboxService } from '@supplier/outbox/outbox.service';

@Module({
   imports: [PrismaModule],
   providers: [OutboxService],
   exports: [OutboxService],
})
export class OutboxModule {}
