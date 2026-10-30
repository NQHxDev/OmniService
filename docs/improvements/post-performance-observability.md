# Post Creation: Performance & Observability Issues

## Performance Issues

### 1. **N+1 Query in Tag Creation** (MEDIUM)

```typescript
// apps/post/src/repositories/post.repository.ts:148-157
const tagRecords = await Promise.all(
   combinedTags.map(async (tagName) => {
      const slug = tagName.toLowerCase().replace(/[^a-z0-9À-ỹ]/g, '-');
      return tx.tag.upsert({
         // ⚠️ N separate DB calls
         where: { name: tagName },
         create: { name: tagName, slug: slug || tagName, usageCount: 1 },
         update: { usageCount: { increment: 1 } },
      });
   }),
);
```

**Impact**: Creating post with 10 tags = 10 sequential DB roundtrips inside transaction

**Solution**: Use batch upsert

```typescript
// Better approach: Batch operations
const tagRecords = await tx.tag.findMany({
   where: { name: { in: combinedTags } },
});

const existingTags = new Map(tagRecords.map((t) => [t.name, t]));
const newTags = combinedTags.filter((name) => !existingTags.has(name));

// Batch create new tags
if (newTags.length > 0) {
   await tx.tag.createMany({
      data: newTags.map((name) => ({
         name,
         slug: name.toLowerCase().replace(/[^a-z0-9À-ỹ]/g, '-'),
         usageCount: 1,
      })),
      skipDuplicates: true,
   });
}

// Batch increment existing tags
if (existingTags.size > 0) {
   await tx.tag.updateMany({
      where: { name: { in: Array.from(existingTags.keys()) } },
      data: { usageCount: { increment: 1 } },
   });
}

// Fetch all tags for relation
const allTags = await tx.tag.findMany({
   where: { name: { in: combinedTags } },
});
```

### 2. **Large Nested Create Transaction** (MEDIUM)

```typescript
// Current: One giant transaction with all nested creates
return tx.post.create({
   data: {
      // ... 20 fields
      ingredients: { create: [...] },  // Up to 100 items
      recipe: {
         create: {
            // ... recipe fields
            steps: { create: [...] },  // Up to 50 steps
         },
      },
      tags: { create: [...] },  // Up to 30 tags
      mentions: { create: [...] },  // Up to 50 mentions
      categories: { create: [...] },
   },
   include: POST_RELATIONS_INCLUDE,  // ⚠️ Fetching everything back
});
```

**Impact**:

- Long transaction time → Lock contention
- Large query size
- Memory overhead

**Solutions**:

**Option A**: Split into smaller transactions (for non-critical relations)

```typescript
// Critical write in one transaction
const post = await this.prisma.$transaction(async (tx) => {
   return tx.post.create({
      data: {
         // Core fields only
         userId,
         title,
         videoUrl,
         thumbnailUrl,
         // ...
      },
   });
});

// Non-critical writes (tags, mentions) can be separate transactions
await this.prisma.$transaction([
   this.prisma.postTag.createMany({
      data: tagRecords.map((tag) => ({ postId: post.postId, tagId: tag.tagId })),
   }),
   this.prisma.postMention.createMany({
      data: mentionedUserIds.map((userId) => ({ postId: post.postId, userId })),
   }),
]);
```

**Option B**: Use batch inserts where possible

```typescript
// Instead of nested create for ingredients
ingredients: {
   create: data.ingredients.map((ing, idx) => ({ ... }))
}

// Use createMany (faster, but no relations)
await tx.postIngredient.createMany({
   data: data.ingredients.map((ing, idx) => ({
      postId: post.postId,
      name: ing.name,
      amount: ing.amount,
      unit: ing.unit,
      sortOrder: ing.sortOrder ?? idx,
   })),
});
```

### 3. **Missing Database Indexes** (HIGH)

```prisma
// Check current indexes
model Post {
   postId    String   @id @default(uuid())
   userId    String
   status    PostStatus
   visibility Visibility
   createdAt DateTime @default(now())

   // ⚠️ Missing critical indexes for feed queries
}
```

**Add these indexes**:

```prisma
model Post {
   postId    String   @id @default(uuid())
   userId    String
   status    PostStatus
   visibility Visibility
   createdAt DateTime @default(now())

   // ✅ Feed query optimization
   @@index([status, visibility, createdAt(sort: Desc), postId(sort: Desc)])

   // ✅ User's posts
   @@index([userId, createdAt(sort: Desc)])

   // ✅ Idempotency check
   @@unique([userId, idempotencyKey])
}

model PostTag {
   postId String
   tagId  String

   @@id([postId, tagId])
   @@index([tagId, postId])  // ✅ For tag-based feed queries
}

model PostCategory {
   postId     String
   categoryId String

   @@id([postId, categoryId])
   @@index([categoryId, postId])  // ✅ For category-based feed queries
}
```

## Observability Issues

### 1. **Missing Distributed Tracing** (MEDIUM)

```typescript
// Current: No trace context propagation
async createPost(userId: string, dto: CreatePostDto): Promise<PostItemDto> {
   // ⚠️ No span creation
   const entity = await this.postRepository.create(userId, dto);
   // ⚠️ No trace propagation to events
   this.searchClient.emit(POST_EVENTS.CREATED, eventPayload);
}
```

**Solution**: Add OpenTelemetry spans

```typescript
import { trace, context, SpanStatusCode } from '@opentelemetry/api';

async createPost(userId: string, dto: CreatePostDto): Promise<PostItemDto> {
   const tracer = trace.getTracer('post-service');

   return tracer.startActiveSpan('post.create', async (span) => {
      try {
         span.setAttributes({
            'user.id': userId,
            'post.title': dto.title,
            'post.has_recipe': !!dto.recipe,
            'post.ingredient_count': dto.ingredients?.length || 0,
         });

         // Repository call
         const entity = await this.postRepository.create(userId, dto);

         // Propagate trace context to events
         const traceContext = trace.getSpanContext(span);
         this.searchClient.emit(POST_EVENTS.CREATED, {
            ...eventPayload,
            traceContext,  // ✅ Propagate for distributed tracing
         });

         span.setStatus({ code: SpanStatusCode.OK });
         return this.mapEntityToDto(entity);
      } catch (error) {
         span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error.message,
         });
         throw error;
      } finally {
         span.end();
      }
   });
}
```

### 2. **Insufficient Metrics** (MEDIUM)

```typescript
// Current: Only basic logging
this.logger.log(`Published ${POST_EVENTS.CREATED} event for post ${entity.postId}`);
```

**Add business metrics**:

```typescript
import { Counter, Histogram } from 'prom-client';

export class PostService {
   private readonly postCreationCounter = new Counter({
      name: 'post_creation_total',
      help: 'Total number of posts created',
      labelNames: ['status', 'has_recipe', 'visibility'],
   });

   private readonly postCreationDuration = new Histogram({
      name: 'post_creation_duration_seconds',
      help: 'Post creation duration',
      labelNames: ['has_recipe'],
      buckets: [0.1, 0.5, 1, 2, 5],
   });

   private readonly ingredientCount = new Histogram({
      name: 'post_ingredient_count',
      help: 'Number of ingredients per post',
      buckets: [0, 1, 5, 10, 20, 50],
   });

   async createPost(userId: string, dto: CreatePostDto): Promise<PostItemDto> {
      const startTime = Date.now();

      try {
         const entity = await this.postRepository.create(userId, dto);

         // Record metrics
         this.postCreationCounter.inc({
            status: 'success',
            has_recipe: dto.recipe ? 'true' : 'false',
            visibility: dto.visibility || 'PUBLIC',
         });

         this.postCreationDuration.observe(
            { has_recipe: dto.recipe ? 'true' : 'false' },
            (Date.now() - startTime) / 1000,
         );

         if (dto.ingredients?.length) {
            this.ingredientCount.observe(dto.ingredients.length);
         }

         return this.mapEntityToDto(entity);
      } catch (error) {
         this.postCreationCounter.inc({
            status: 'error',
            has_recipe: dto.recipe ? 'true' : 'false',
            visibility: dto.visibility || 'PUBLIC',
         });
         throw error;
      }
   }
}
```

### 3. **Missing Structured Logging** (LOW)

```typescript
// Current: String-only logs
this.logger.log(`Published ${POST_EVENTS.CREATED} event for post ${entity.postId}`);
this.logger.error(`Failed to emit post.created event: ${(err as Error).message}`);
```

**Use structured logging**:

```typescript
this.logger.log({
   message: 'Post created successfully',
   postId: entity.postId,
   userId: entity.userId,
   hasRecipe: !!entity.recipe,
   ingredientCount: entity.ingredients.length,
   duration: Date.now() - startTime,
});

this.logger.error({
   message: 'Failed to emit post.created event',
   error: err.message,
   stack: err.stack,
   postId: entity.postId,
   eventType: POST_EVENTS.CREATED,
});
```

## Recommendations

### Performance

- [ ] Fix N+1 query in tag creation (batch operations)
- [ ] Add database indexes for feed queries
- [ ] Consider splitting large transactions
- [ ] Add query performance monitoring

### Observability

- [ ] Add distributed tracing with OpenTelemetry
- [ ] Add business metrics (creation rate, duration, failure rate)
- [ ] Switch to structured logging
- [ ] Add alerting on error rates

### Monitoring Dashboard Should Show

- Posts created per minute/hour
- Creation latency (p50, p95, p99)
- Error rate and types
- Event publishing lag
- Transaction duration
- Cache hit rates
