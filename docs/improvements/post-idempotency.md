# Post Creation: Idempotency Implementation

## Problem

No protection against duplicate post creation from:

- Network retries
- User double-clicks
- Client bugs

## Solution: Idempotency Key Pattern

### 1. Add Idempotency Key to DTO

```typescript
// libs/contracts/post/src/dto/create-post.dto.ts
export class CreatePostDto {
   @ApiPropertyOptional({
      description: 'Idempotency key to prevent duplicate post creation (optional but recommended)',
      example: 'idp_0192e21b-0002-7000-8000-000000000001',
   })
   @IsString()
   @IsOptional()
   @MaxLength(128)
   idempotencyKey?: string;

   // ... existing fields
}
```

### 2. Database Schema

```prisma
// apps/post/prisma/schema.prisma
model Post {
   postId           String   @id @default(uuid())
   userId           String
   idempotencyKey   String?  @unique  // ✅ Add this
   // ... existing fields

   @@index([userId, idempotencyKey])
}
```

### 3. Service Layer Implementation

```typescript
// apps/post/src/services/post.service.ts
async createPost(userId: string, dto: CreatePostDto): Promise<PostItemDto> {
   // Validate required fields
   if (!userId) {
      throw new BadRequestException(POST_ERROR_CODES.UNAUTHORIZED);
   }
   if (!dto.title || !dto.videoUrl || !dto.thumbnailUrl || !dto.duration) {
      throw new BadRequestException(POST_ERROR_CODES.CREATE_FAILED);
   }

   // ✅ Idempotency check
   if (dto.idempotencyKey) {
      const existing = await this.postRepository.findByIdempotencyKey(
         userId,
         dto.idempotencyKey,
      );

      if (existing) {
         this.logger.log(
            `Returning existing post ${existing.postId} for idempotency key ${dto.idempotencyKey}`,
         );
         return this.mapEntityToDto(existing);
      }
   }

   // Create new post
   const entity = await this.postRepository.create(userId, dto);
   const postDto = this.mapEntityToDto(entity);

   // ... existing event publishing logic

   return postDto;
}
```

### 4. Repository Implementation

```typescript
// apps/post/src/repositories/post.repository.ts
async findByIdempotencyKey(
   userId: string,
   idempotencyKey: string,
): Promise<PostEntity | null> {
   const post = await this.prisma.post.findUnique({
      where: {
         userId_idempotencyKey: {
            userId,
            idempotencyKey,
         },
      },
      include: POST_RELATIONS_INCLUDE,
   });

   return post ? new PostEntity(post) : null;
}

async create(userId: string, data: CreatePostDto): Promise<PostEntity> {
   const createdPost = await this.prisma.$transaction(async (tx) => {
      // ... existing logic

      return tx.post.create({
         data: {
            userId,
            idempotencyKey: data.idempotencyKey, // ✅ Store key
            // ... existing fields
         },
         include: POST_RELATIONS_INCLUDE,
      });
   });

   return new PostEntity(createdPost);
}
```

### 5. Client-Side Best Practice

```typescript
// Frontend example
async function createPost(postData: CreatePostDto) {
   const idempotencyKey = `idp_${crypto.randomUUID()}`;

   const response = await fetch('/api/v1/posts', {
      method: 'POST',
      body: JSON.stringify({
         ...postData,
         idempotencyKey,
      }),
   });

   return response.json();
}
```

## Benefits

- ✅ Safe retries (network errors, timeouts)
- ✅ Prevents duplicate posts from UI bugs
- ✅ RESTful best practice
- ✅ Backward compatible (optional field)

## Trade-offs

- Additional DB index space
- Idempotency keys should be cleaned up after 24h (add TTL cleanup job)
