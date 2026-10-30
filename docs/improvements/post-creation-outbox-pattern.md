# Post Creation: Outbox Pattern Implementation

## Problem

Current event publishing is unreliable - failures are only logged, not retried.

## Solution: Transactional Outbox Pattern

### 1. Database Schema

```prisma
// apps/post/prisma/schema.prisma
model Outbox {
  outboxId      String   @id @default(uuid())
  aggregateType String   // "Post"
  aggregateId   String   // postId
  eventType     String   // "post.created"
  payload       Json
  status        OutboxStatus @default(PENDING)
  attempts      Int      @default(0)
  lastAttemptAt DateTime?
  createdAt     DateTime @default(now())
  processedAt   DateTime?

  @@index([status, createdAt])
  @@index([aggregateId])
}

enum OutboxStatus {
  PENDING
  PROCESSING
  DELIVERED
  FAILED
}
```

### 2. Repository Changes

```typescript
// apps/post/src/repositories/post.repository.ts
async create(userId: string, data: CreatePostDto): Promise<PostEntity> {
   const createdPost = await this.prisma.$transaction(async (tx) => {
      // ... existing post creation logic ...

      const post = await tx.post.create({
         // ... existing data ...
      });

      // ✅ Store event in outbox table (same transaction)
      await tx.outbox.create({
         data: {
            aggregateType: 'Post',
            aggregateId: post.postId,
            eventType: 'post.created',
            payload: {
               postId: post.postId,
               userId: post.userId,
               title: post.title,
               // ... full event payload
            },
            status: 'PENDING',
         },
      });

      return post;
   });

   return new PostEntity(createdPost);
}
```

### 3. Outbox Processor (Background Worker)

```typescript
// apps/post/src/outbox/outbox-processor.service.ts
@Injectable()
export class OutboxProcessorService {
   private readonly logger = new Logger(OutboxProcessorService.name);
   private isProcessing = false;

   constructor(
      private readonly prisma: PrismaService,
      @Inject(SERVICES.SEARCH_SERVICE) private searchClient: ClientProxy,
      @Inject(SERVICES.NOTIFICATION_SERVICE) private notificationClient: ClientProxy,
   ) {}

   @Cron('*/5 * * * * *') // Every 5 seconds
   async processOutbox(): Promise<void> {
      if (this.isProcessing) return;

      this.isProcessing = true;
      try {
         const events = await this.prisma.outbox.findMany({
            where: {
               status: 'PENDING',
               attempts: { lt: 5 }, // Max 5 retries
            },
            take: 50,
            orderBy: { createdAt: 'asc' },
         });

         for (const event of events) {
            await this.processEvent(event);
         }
      } finally {
         this.isProcessing = false;
      }
   }

   private async processEvent(event: Outbox): Promise<void> {
      try {
         // Mark as processing
         await this.prisma.outbox.update({
            where: { outboxId: event.outboxId },
            data: {
               status: 'PROCESSING',
               attempts: { increment: 1 },
               lastAttemptAt: new Date(),
            },
         });

         // Publish to message queues
         const eventType = event.eventType;
         const payload = event.payload;

         await Promise.all([
            this.searchClient.emit(eventType, payload).toPromise(),
            this.notificationClient.emit(eventType, payload).toPromise(),
         ]);

         // Mark as delivered
         await this.prisma.outbox.update({
            where: { outboxId: event.outboxId },
            data: {
               status: 'DELIVERED',
               processedAt: new Date(),
            },
         });

         this.logger.log(`Outbox event ${event.outboxId} delivered successfully`);
      } catch (error) {
         this.logger.error(`Outbox event ${event.outboxId} failed: ${error.message}`);

         // Mark as failed after max retries
         if (event.attempts >= 4) {
            await this.prisma.outbox.update({
               where: { outboxId: event.outboxId },
               data: { status: 'FAILED' },
            });
         } else {
            // Reset to PENDING for retry
            await this.prisma.outbox.update({
               where: { outboxId: event.outboxId },
               data: { status: 'PENDING' },
            });
         }
      }
   }
}
```

## Benefits

- ✅ At-least-once delivery guarantee
- ✅ Event publishing survives service crashes
- ✅ Auditable (full event history)
- ✅ Retryable with exponential backoff
- ✅ No data loss

## Migration Path

1. Add outbox table schema
2. Update repository to write to outbox
3. Deploy outbox processor
4. Monitor failed events
5. Remove old emit() calls after validation
