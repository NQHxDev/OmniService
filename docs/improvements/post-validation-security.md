# Post Creation: Validation & Security Issues

## Issues Found

### 1. **Missing Content Moderation** (HIGH)

```typescript
// Current: No content filtering
async createPost(userId: string, dto: CreatePostDto): Promise<PostItemDto> {
   // ⚠️ No spam check, profanity filter, or malicious content detection
   const entity = await this.postRepository.create(userId, dto);
}
```

**Risks**:

- Spam posts flooding the platform
- Inappropriate content (profanity, hate speech)
- XSS attacks via caption/title
- Phishing URLs in captions

**Solutions**:

```typescript
// Add content moderation service
async createPost(userId: string, dto: CreatePostDto): Promise<PostItemDto> {
   // 1. Sanitize HTML/XSS
   dto.title = sanitizeHtml(dto.title, { allowedTags: [] });
   dto.caption = sanitizeHtml(dto.caption || '', { allowedTags: [] });

   // 2. Check profanity filter
   const hasProfanity = await this.moderationService.checkProfanity(dto.title, dto.caption);
   if (hasProfanity) {
      throw new BadRequestException('CONTENT_CONTAINS_INAPPROPRIATE_LANGUAGE');
   }

   // 3. Validate URLs (prevent phishing)
   const urls = extractUrls(dto.caption || '');
   const isSafe = await this.moderationService.checkUrlSafety(urls);
   if (!isSafe) {
      throw new BadRequestException('CONTENT_CONTAINS_UNSAFE_URLS');
   }

   // 4. Rate limiting per user
   await this.checkRateLimit(userId);

   // 5. Check user reputation
   const canPost = await this.userReputationService.canCreatePost(userId);
   if (!canPost) {
      throw new ForbiddenException('USER_TEMPORARILY_RESTRICTED');
   }

   // Create post
   const entity = await this.postRepository.create(userId, dto);

   // 6. Async AI moderation (post-creation)
   this.moderationQueue.add('analyze-post', { postId: entity.postId });

   return this.mapEntityToDto(entity);
}
```

### 2. **Missing Media Validation** (HIGH)

```typescript
// Current: No validation that media URLs actually exist
@IsUrl()
videoUrl!: string;

@IsUrl()
thumbnailUrl!: string;
```

**Risks**:

- Broken links → Bad UX
- Not verified that user owns the media
- No check if media is from allowed domains

**Solutions**:

```typescript
// Add media ownership validation
async createPost(userId: string, dto: CreatePostDto): Promise<PostItemDto> {
   // Verify media ownership
   if (dto.mediaId) {
      const mediaOwnership = await this.mediaClient.verifyOwnership({
         mediaId: dto.mediaId,
         userId: userId,
      });

      if (!mediaOwnership.isOwner) {
         throw new ForbiddenException('MEDIA_NOT_OWNED_BY_USER');
      }

      // Verify URLs match mediaId
      if (mediaOwnership.videoUrl !== dto.videoUrl) {
         throw new BadRequestException('VIDEO_URL_MISMATCH');
      }
   } else {
      // If no mediaId, verify URLs are from allowed domains
      const allowedDomains = ['pub-50b1ab619efd4084959e011fe2e5a273.r2.dev'];
      const videoDomain = new URL(dto.videoUrl).hostname;
      const thumbDomain = new URL(dto.thumbnailUrl).hostname;

      if (!allowedDomains.includes(videoDomain) || !allowedDomains.includes(thumbDomain)) {
         throw new BadRequestException('MEDIA_FROM_UNAUTHORIZED_DOMAIN');
      }
   }

   // ... rest of creation logic
}
```

### 3. **Insufficient Input Validation** (MEDIUM)

**Issues**:

```typescript
// No max array size limits
@IsArray()
tags?: string[];  // ⚠️ User could send 10,000 tags

@IsArray()
mentionedUserIds?: string[];  // ⚠️ User could mention 1,000 people

@IsArray()
ingredients?: CreatePostIngredientDto[];  // ⚠️ Could send 500 ingredients
```

**Solutions**:

```typescript
// Add size constraints
export class CreatePostDto {
   @IsArray()
   @IsString({ each: true })
   @ArrayMaxSize(30) // ✅ Max 30 tags
   @IsOptional()
   tags?: string[];

   @IsArray()
   @IsUUID('4', { each: true })
   @ArrayMaxSize(50) // ✅ Max 50 mentions
   @IsOptional()
   mentionedUserIds?: string[];

   @IsArray()
   @ValidateNested({ each: true })
   @ArrayMaxSize(100) // ✅ Max 100 ingredients
   @Type(() => CreatePostIngredientDto)
   @IsOptional()
   ingredients?: CreatePostIngredientDto[];

   @ValidateNested()
   @Type(() => CreateRecipeDto)
   @IsOptional()
   recipe?: CreateRecipeDto;
}

export class CreateRecipeDto {
   @IsArray()
   @ValidateNested({ each: true })
   @ArrayMaxSize(50) // ✅ Max 50 recipe steps
   @Type(() => CreateRecipeStepDto)
   @IsOptional()
   steps?: CreateRecipeStepDto[];
}
```

### 4. **Missing Business Rules Validation** (MEDIUM)

```typescript
// Add business logic validation
async createPost(userId: string, dto: CreatePostDto): Promise<PostItemDto> {
   // 1. Validate user exists and is active
   const user = await this.userService.getUser(userId);
   if (!user.isActive || user.isBanned) {
      throw new ForbiddenException('USER_NOT_ALLOWED_TO_POST');
   }

   // 2. Validate mentioned users exist
   if (dto.mentionedUserIds?.length) {
      const users = await this.userService.getUsersByIds(dto.mentionedUserIds);
      const foundIds = users.map(u => u.userId);
      const missing = dto.mentionedUserIds.filter(id => !foundIds.includes(id));

      if (missing.length > 0) {
         throw new BadRequestException('MENTIONED_USERS_NOT_FOUND', { userIds: missing });
      }
   }

   // 3. Validate categories exist
   if (dto.categoryIds?.length) {
      const categories = await this.categoryService.getByIds(dto.categoryIds);
      if (categories.length !== dto.categoryIds.length) {
         throw new BadRequestException('INVALID_CATEGORIES');
      }
   }

   // 4. Validate catalog ingredients if provided
   if (dto.ingredients?.length) {
      const catalogIds = dto.ingredients
         .map(i => i.catalogIngredientId)
         .filter(Boolean) as string[];

      if (catalogIds.length > 0) {
         const validIngredients = await this.commerceService.validateIngredients(catalogIds);
         if (!validIngredients.allValid) {
            throw new BadRequestException('INVALID_CATALOG_INGREDIENTS', {
               invalidIds: validIngredients.invalidIds,
            });
         }
      }
   }

   // 5. Validate video duration
   if (dto.duration < 3 || dto.duration > 600) {  // 3s - 10min
      throw new BadRequestException('VIDEO_DURATION_OUT_OF_RANGE', {
         min: 3,
         max: 600,
         actual: dto.duration,
      });
   }

   // ... proceed with creation
}
```

## Recommendations

### Priority 1 (Implement Now)

- [ ] Add XSS sanitization
- [ ] Add rate limiting per user
- [ ] Add media ownership validation
- [ ] Add array size limits

### Priority 2 (Next Sprint)

- [ ] Implement content moderation service
- [ ] Add profanity filter
- [ ] Add URL safety checker
- [ ] Add user reputation system

### Priority 3 (Future)

- [ ] AI-powered content moderation
- [ ] Image recognition for thumbnails
- [ ] Automated NSFW detection
