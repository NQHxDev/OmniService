import { Controller } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import { AppLogger, QUEUES, RedisService, RmqService } from '@common';
import { POST_EVENTS } from '@contracts/post';
import { USER_EVENTS } from '@contracts/user';
import { SUPPLIER_EVENTS } from '@contracts/supplier';
import { POST_SEARCH_CONSTANTS } from '@search/domains/post-search/post-search.constants';
import { PostSearchService, type PostDocument } from '@search/domains/post-search/post-search.service';

export interface PostEventPayload {
   idempotencyKey?: string;
   eventId?: string;
   postId: string;
   userId: string;
   title: string;
   caption?: string | null;
   mediaId?: string | null;
   videoUrl: string;
   playbackUrl?: string | null;
   thumbnailUrl: string;
   blurHash?: string | null;
   duration?: number;
   videoWidth?: number | null;
   videoHeight?: number | null;
   viewCount?: number;
   likeCount?: number;
   commentCount?: number;
   shareCount?: number;
   saveCount?: number;
   allowComments?: boolean;
   allowDuet?: boolean;
   createdAt?: Date | string;
   updatedAt?: Date | string;
   author?: {
      userId: string;
      displayName?: string | null;
      avatarUrl?: string | null;
      isVerified?: boolean;
      followerCount?: number;
   };
   shop?: {
      shopId: string;
      shopName?: string | null;
      logoUrl?: string | null;
   } | null;
   ingredients?: Array<{
      ingredientId: string;
      name: string;
      amount: number;
      unit: string;
      group?: string | null;
      sortOrder: number;
   }>;
   tags?: string[];
   category?: string | null;
}

export interface PostDeletedPayload {
   idempotencyKey?: string;
   eventId?: string;
   postId: string;
}

export interface UserProfileUpdatedPayload {
   idempotencyKey?: string;
   eventId?: string;
   userId: string;
   displayName?: string | null;
   avatarUrl?: string | null;
   avatar?: string | null;
   isVerified?: boolean;
   followerCount?: number;
   followersCount?: number;
}

export interface SupplierInfoUpdatedPayload {
   idempotencyKey?: string;
   eventId?: string;
   supplierId?: string;
   shopId?: string;
   supplierName?: string | null;
   shopName?: string | null;
   supplierLogoUrl?: string | null;
   logoUrl?: string | null;
}

@Controller()
export class PostProjectionConsumer {
   constructor(
      private readonly postSearchService: PostSearchService,
      private readonly redisService: RedisService,
      private readonly rmqService: RmqService,
      private readonly logger: AppLogger,
   ) {
      this.logger.setContext(PostProjectionConsumer.name);
   }

   /**
    * Helper ensuring idempotent message processing using Redis atomic SET NX.
    * Returns true if already processed, false otherwise.
    */
   private async isDuplicateAndMark(eventKey: string): Promise<boolean> {
      const redisKey = POST_SEARCH_CONSTANTS.IDEMPOTENCY.buildKey(eventKey);
      const client = this.redisService.getClient();
      if (client) {
         try {
            const res = await client.set(redisKey, '1', 'EX', POST_SEARCH_CONSTANTS.IDEMPOTENCY.TTL_SECONDS, 'NX');
            return res !== 'OK';
         } catch (error) {
            this.logger.warn(`Idempotency check Redis error: ${(error as Error).message}`);
         }
      }
      return false;
   }

   private async clearIdempotency(eventKey: string): Promise<void> {
      try {
         const redisKey = POST_SEARCH_CONSTANTS.IDEMPOTENCY.buildKey(eventKey);
         await this.redisService.del(redisKey);
      } catch {
         // Ignore
      }
   }

   @EventPattern(POST_EVENTS.CREATED)
   @EventPattern(POST_EVENTS.PUBLISHED)
   async handlePostCreatedOrPublished(@Payload() data: PostEventPayload, @Ctx() context?: RmqContext): Promise<void> {
      const eventKey =
         data.eventId || data.idempotencyKey || `${POST_SEARCH_CONSTANTS.EVENTS.POST_PUBLISHED_PREFIX}:${data.postId}`;
      try {
         const isDuplicate = await this.isDuplicateAndMark(eventKey);
         if (isDuplicate) {
            this.logger.debug(`Duplicate event skipped: ${eventKey}`);
            if (context) this.rmqService.ack(context);
            return;
         }

         this.logger.log(`Projecting post ${data.postId} into Elasticsearch read model`);

         const postDoc: PostDocument & {
            likeCount?: number;
            viewCount?: number;
            commentCount?: number;
            shareCount?: number;
            saveCount?: number;
         } = {
            postId: data.postId,
            userId: data.userId,
            title: data.title,
            caption: data.caption,
            mediaId: data.mediaId,
            videoUrl: data.videoUrl,
            playbackUrl: data.playbackUrl,
            thumbnailUrl: data.thumbnailUrl,
            blurHash: data.blurHash,
            duration: data.duration ?? 0,
            videoWidth: data.videoWidth,
            videoHeight: data.videoHeight,
            allowComments: data.allowComments ?? true,
            allowDuet: data.allowDuet ?? false,
            createdAt: data.createdAt ?? new Date(),
            updatedAt: data.updatedAt ?? new Date(),
            author: data.author ?? { userId: data.userId },
            shop: data.shop,
            ingredients: (data.ingredients || []).map((ing) => ({
               ingredientId: ing.ingredientId,
               name: ing.name,
               amount: ing.amount,
               unit: ing.unit,
               group: ing.group,
               sortOrder: ing.sortOrder,
            })),
            tags: data.tags ?? [],
            category: data.category,
            likeCount: data.likeCount ?? 0,
            viewCount: data.viewCount ?? 0,
            commentCount: data.commentCount ?? 0,
            shareCount: data.shareCount ?? 0,
            saveCount: data.saveCount ?? 0,
         };

         await this.postSearchService.indexPost(postDoc);

         if (context) {
            this.rmqService.ack(context);
         }
      } catch (error) {
         await this.clearIdempotency(eventKey);
         this.logger.error(`Error projecting post ${data.postId}`, error instanceof Error ? error.stack : undefined);
         await this.rmqService.handleError(error, context, { queue: QUEUES.SEARCH });
      }
   }

   @EventPattern(POST_EVENTS.UPDATED)
   async handlePostUpdated(@Payload() data: PostEventPayload, @Ctx() context?: RmqContext): Promise<void> {
      const eventKey =
         data.eventId ||
         data.idempotencyKey ||
         `post.updated:${data.postId}:${data.updatedAt ? String(data.updatedAt) : Date.now()}`;
      try {
         const isDuplicate = await this.isDuplicateAndMark(eventKey);
         if (isDuplicate) {
            this.logger.debug(`Duplicate event skipped: ${eventKey}`);
            if (context) this.rmqService.ack(context);
            return;
         }

         this.logger.log(`Updating post projection for ${data.postId}`);
         await this.postSearchService.updatePost(data.postId, {
            title: data.title,
            caption: data.caption,
            mediaId: data.mediaId,
            videoUrl: data.videoUrl,
            playbackUrl: data.playbackUrl,
            thumbnailUrl: data.thumbnailUrl,
            blurHash: data.blurHash,
            duration: data.duration,
            videoWidth: data.videoWidth,
            videoHeight: data.videoHeight,
            allowComments: data.allowComments,
            allowDuet: data.allowDuet,
            tags: data.tags,
            category: data.category,
            ingredients: data.ingredients,
            shop: data.shop,
            author: data.author,
         });

         if (context) {
            this.rmqService.ack(context);
         }
      } catch (error) {
         await this.clearIdempotency(eventKey);
         this.logger.error(
            `Error updating post projection ${data.postId}`,
            error instanceof Error ? error.stack : undefined,
         );
         await this.rmqService.handleError(error, context, { queue: QUEUES.SEARCH });
      }
   }

   @EventPattern(POST_EVENTS.DELETED)
   async handlePostDeleted(@Payload() data: PostDeletedPayload, @Ctx() context?: RmqContext): Promise<void> {
      const eventKey = data.eventId || data.idempotencyKey || `post.deleted:${data.postId}`;
      try {
         const isDuplicate = await this.isDuplicateAndMark(eventKey);
         if (isDuplicate) {
            this.logger.debug(`Duplicate event skipped: ${eventKey}`);
            if (context) this.rmqService.ack(context);
            return;
         }

         this.logger.log(`Deleting post projection and counters for ${data.postId}`);
         await this.postSearchService.deletePost(data.postId);

         if (context) {
            this.rmqService.ack(context);
         }
      } catch (error) {
         await this.clearIdempotency(eventKey);
         this.logger.error(
            `Error deleting post projection ${data.postId}`,
            error instanceof Error ? error.stack : undefined,
         );
         await this.rmqService.handleError(error, context, { queue: QUEUES.SEARCH });
      }
   }

   @EventPattern(USER_EVENTS.UPDATED)
   @EventPattern('user.profile_updated')
   async handleUserProfileUpdated(
      @Payload() data: UserProfileUpdatedPayload,
      @Ctx() context?: RmqContext,
   ): Promise<void> {
      const eventKey = data.eventId || data.idempotencyKey || `user.profile_updated:${data.userId}:${Date.now()}`;
      try {
         const isDuplicate = await this.isDuplicateAndMark(eventKey);
         if (isDuplicate) {
            this.logger.debug(`Duplicate event skipped: ${eventKey}`);
            if (context) this.rmqService.ack(context);
            return;
         }

         this.logger.log(`Received user profile update for ${data.userId}, propagating to denormalized posts`);
         await this.postSearchService.updateAuthorProfile(data.userId, {
            displayName: data.displayName,
            avatarUrl: data.avatarUrl || data.avatar,
            isVerified: data.isVerified,
            followerCount: data.followerCount ?? data.followersCount,
         });

         if (context) {
            this.rmqService.ack(context);
         }
      } catch (error) {
         await this.clearIdempotency(eventKey);
         this.logger.error(
            `Error updating author profile in posts for user ${data.userId}`,
            error instanceof Error ? error.stack : undefined,
         );
         await this.rmqService.handleError(error, context, { queue: QUEUES.SEARCH });
      }
   }

   @EventPattern(SUPPLIER_EVENTS.SUPPLIER_UPDATED)
   @EventPattern('supplier.info_updated')
   async handleSupplierInfoUpdated(
      @Payload() data: SupplierInfoUpdatedPayload,
      @Ctx() context?: RmqContext,
   ): Promise<void> {
      const shopId = data.shopId || data.supplierId;
      if (!shopId) {
         if (context) this.rmqService.ack(context);
         return;
      }

      const eventKey = data.eventId || data.idempotencyKey || `supplier.info_updated:${shopId}:${Date.now()}`;
      try {
         const isDuplicate = await this.isDuplicateAndMark(eventKey);
         if (isDuplicate) {
            this.logger.debug(`Duplicate event skipped: ${eventKey}`);
            if (context) this.rmqService.ack(context);
            return;
         }

         this.logger.log(`Received shop info update for ${shopId}, propagating to denormalized posts`);
         await this.postSearchService.updateShopInfo(shopId, {
            shopName: data.shopName || data.supplierName,
            logoUrl: data.logoUrl || data.supplierLogoUrl,
         });

         if (context) {
            this.rmqService.ack(context);
         }
      } catch (error) {
         await this.clearIdempotency(eventKey);
         this.logger.error(
            `Error updating shop info in posts for shop ${shopId}`,
            error instanceof Error ? error.stack : undefined,
         );
         await this.rmqService.handleError(error, context, { queue: QUEUES.SEARCH });
      }
   }
}
