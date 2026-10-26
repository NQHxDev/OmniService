import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RetryQueueService } from '@common';
import { OutboxService } from '@user/outbox';
import { UserEntity } from '@user/entities';
import { UsernameBloomFilterService } from '@user/services/infrastructure/username-bloom-filter.service';
import { UserGraphSyncService } from '@user/services/infrastructure/user-graph-sync.service';
import { SEARCH_ADAPTER, type ISearchAdapter } from '@user/adapters/search';
import { USER_AGGREGATES, USER_EVENTS, USER_OUTBOX_EVENTS, USER_RETRY_QUEUES } from '@contracts/user';
import { USER_DOMAIN_EVENTS } from '@user/domain/events';
import { USER_DOMAIN_EVENT_FACTORY, USER_PROFILE_SYNC_FIELDS, PROFILE_METADATA_FIELDS } from '@user/constants';
import { UserDomainEventFactory } from '@user/factories/user-domain-event.factory';
import type { IUserDomainEventFactory } from '@user/factories/user-domain-event.factory.interface';
import type { UpdateUserData } from '@user/repositories/user-profile.repository';

/**
 * ProfileSyncService coordinates cross-cutting synchronization concerns:
 * - Search engine indexing (via ISearchAdapter)
 * - Graph database synchronization (via UserGraphSyncService)
 * - Redis Bloom Filter updating (via UsernameBloomFilterService)
 * - Transactional Outbox publishing (via OutboxService)
 * - Local domain event dispatching (via EventEmitter2)
 */
@Injectable()
export class ProfileSyncService {
   private readonly logger = new Logger(ProfileSyncService.name);
   private readonly domainEventFactory: IUserDomainEventFactory;

   constructor(
      private readonly outboxService: OutboxService,
      private readonly userGraphSyncService: UserGraphSyncService,
      private readonly usernameBloomFilterService: UsernameBloomFilterService,
      @Inject(SEARCH_ADAPTER)
      private readonly searchAdapter: ISearchAdapter,
      @Optional()
      private readonly retryQueueService?: RetryQueueService,
      @Optional()
      private readonly eventEmitter?: EventEmitter2,
      @Optional()
      @Inject(USER_DOMAIN_EVENT_FACTORY)
      domainEventFactory?: IUserDomainEventFactory,
   ) {
      this.domainEventFactory = domainEventFactory ?? new UserDomainEventFactory();
   }

   async syncUserCreated(user: UserEntity): Promise<void> {
      if (user.username) {
         await this.usernameBloomFilterService.addUsername(user.username);
      }

      await this.syncGraphWithFallback(user);

      await this.outboxService.createOutboxEvent(user.userId, USER_AGGREGATES.USER, USER_OUTBOX_EVENTS.USER_CREATED, {
         userId: user.userId,
         accountId: user.accountId,
         username: user.username,
      });

      this.emitSearchIndexEvent(USER_EVENTS.CREATED, user);

      if (this.eventEmitter) {
         this.eventEmitter.emit(
            USER_DOMAIN_EVENTS.USER_CREATED,
            this.domainEventFactory.createUserCreated(
               user.userId,
               user.accountId,
               user.username,
               user.displayName,
               user.createdAt,
            ),
         );
      }
   }

   /**
    * Refactored syncUserUpdated: Emits granular domain events for each field change
    * instead of a single generic USER_UPDATED event.
    *
    * Benefits:
    * - Each business action has its own event (Event Sourcing best practice)
    * - Easier to debug and trace specific changes
    * - Prevents conflicts when updating multiple fields
    * - Better event replay and auditing
    */
   async syncUserUpdated(
      user: UserEntity,
      changes: Record<string, unknown> | UpdateUserData,
      previousUser?: UserEntity,
   ): Promise<void> {
      // 1. Handle username change (already existing logic)
      const username = 'username' in changes ? changes.username : undefined;
      if (username && typeof username === 'string') {
         await this.usernameBloomFilterService.updateUsername(username, previousUser?.username);

         if (previousUser && previousUser.username?.toLowerCase() !== username.toLowerCase()) {
            // Emit specific USERNAME_CHANGED event
            await this.outboxService.createOutboxEvent(
               user.userId,
               USER_AGGREGATES.USER,
               USER_OUTBOX_EVENTS.USER_UPDATED,
               {
                  userId: user.userId,
                  accountId: user.accountId,
                  field: USER_PROFILE_SYNC_FIELDS.USERNAME,
                  oldValue: previousUser.username,
                  newValue: username,
               },
            );

            if (this.eventEmitter) {
               this.eventEmitter.emit(
                  USER_DOMAIN_EVENTS.USERNAME_CHANGED,
                  this.domainEventFactory.createUsernameChanged(user.userId, previousUser.username, username),
               );
            }
         }
      }

      // 2. Handle displayName change
      const displayName = 'displayName' in changes ? changes.displayName : undefined;
      if (displayName !== undefined && previousUser && previousUser.displayName !== displayName) {
         await this.outboxService.createOutboxEvent(
            user.userId,
            USER_AGGREGATES.USER,
            USER_OUTBOX_EVENTS.USER_UPDATED,
            {
               userId: user.userId,
               accountId: user.accountId,
               field: USER_PROFILE_SYNC_FIELDS.DISPLAY_NAME,
               oldValue: previousUser.displayName,
               newValue: displayName,
            },
         );

         if (this.eventEmitter) {
            this.eventEmitter.emit(
               USER_DOMAIN_EVENTS.DISPLAY_NAME_CHANGED,
               this.domainEventFactory.createDisplayNameChanged(
                  user.userId,
                  previousUser.displayName,
                  displayName as string | null,
               ),
            );
         }
      }

      // 3. Handle bio change
      const bio = 'bio' in changes ? changes.bio : undefined;
      if (bio !== undefined && previousUser && previousUser.bio !== bio) {
         await this.outboxService.createOutboxEvent(
            user.userId,
            USER_AGGREGATES.USER,
            USER_OUTBOX_EVENTS.USER_UPDATED,
            {
               userId: user.userId,
               accountId: user.accountId,
               field: USER_PROFILE_SYNC_FIELDS.BIO,
               oldValue: previousUser.bio,
               newValue: bio,
            },
         );

         if (this.eventEmitter) {
            this.eventEmitter.emit(
               USER_DOMAIN_EVENTS.BIO_CHANGED,
               this.domainEventFactory.createBioChanged(user.userId, previousUser.bio, bio as string | null),
            );
         }
      }

      // 4. Handle avatar change
      const avatar = 'avatar' in changes ? changes.avatar : undefined;
      if (avatar !== undefined && previousUser && previousUser.avatar !== avatar) {
         await this.outboxService.createOutboxEvent(
            user.userId,
            USER_AGGREGATES.USER,
            USER_OUTBOX_EVENTS.USER_UPDATED,
            {
               userId: user.userId,
               accountId: user.accountId,
               field: USER_PROFILE_SYNC_FIELDS.AVATAR,
               oldValue: previousUser.avatar,
               newValue: avatar,
            },
         );

         // Note: We already have AVATAR_UPLOADED event, but this covers avatar changes/removals
         if (this.eventEmitter && avatar) {
            this.eventEmitter.emit(
               USER_DOMAIN_EVENTS.AVATAR_UPLOADED,
               this.domainEventFactory.createAvatarUploaded(user.userId, avatar as string),
            );
         }
      }

      // 5. Handle metadata fields (website, location, gender, dateOfBirth, coverImage, etc.)
      const metadata: Record<string, unknown> = {};
      let hasMetadataChange = false;

      for (const field of PROFILE_METADATA_FIELDS) {
         if (field in changes) {
            metadata[field] = (changes as Record<string, unknown>)[field];
            hasMetadataChange = true;
         }
      }

      if (hasMetadataChange) {
         await this.outboxService.createOutboxEvent(
            user.userId,
            USER_AGGREGATES.USER,
            USER_OUTBOX_EVENTS.USER_UPDATED,
            {
               userId: user.userId,
               accountId: user.accountId,
               field: USER_PROFILE_SYNC_FIELDS.METADATA,
               changes: metadata,
            },
         );

         if (this.eventEmitter) {
            this.eventEmitter.emit(
               USER_DOMAIN_EVENTS.PROFILE_METADATA_UPDATED,
               this.domainEventFactory.createProfileMetadataUpdated(user.userId, metadata),
            );
         }
      }

      // 6. Sync to graph database (always needed for any profile update)
      await this.syncGraphWithFallback(user);

      // 7. Update search index (aggregate update)
      this.emitSearchIndexEvent(USER_EVENTS.UPDATED, user);
   }

   async syncUserDeleted(userId: string, accountId: string, previousUser?: UserEntity): Promise<void> {
      if (previousUser?.username) {
         await this.usernameBloomFilterService.removeUsername(previousUser.username);
      }

      this.emitSearchDeleteEvent(userId);

      await this.outboxService.createOutboxEvent(userId, USER_AGGREGATES.USER, USER_OUTBOX_EVENTS.USER_DELETED, {
         userId,
         accountId,
      });

      if (this.eventEmitter) {
         this.eventEmitter.emit(
            USER_DOMAIN_EVENTS.USER_DELETED,
            this.domainEventFactory.createUserDeleted(userId, accountId),
         );
      }
   }

   async syncUserRestored(restoredUser: UserEntity): Promise<void> {
      this.emitSearchIndexEvent(USER_EVENTS.CREATED, restoredUser);

      await this.outboxService.createOutboxEvent(
         restoredUser.userId,
         USER_AGGREGATES.USER,
         USER_OUTBOX_EVENTS.USER_RESTORED,
         {
            userId: restoredUser.userId,
            accountId: restoredUser.accountId,
         },
      );

      if (this.eventEmitter) {
         this.eventEmitter.emit(
            USER_DOMAIN_EVENTS.USER_RESTORED,
            this.domainEventFactory.createUserRestored(restoredUser.userId, restoredUser.accountId),
         );
      }
   }

   emitSearchIndexEvent(event: string, user: UserEntity): void {
      const payload = {
         userId: user.userId,
         username: user.username,
         displayName: user.displayName,
         avatar: user.avatar,
         bio: user.bio,
         isVerified: user.isVerified,
         followersCount: user.followersCount,
         followingCount: user.followingCount,
         createdAt: user.createdAt,
         updatedAt: user.updatedAt,
      };

      try {
         this.searchAdapter.emitIndexEvent(event, payload);
      } catch (err) {
         this.logger.warn(`Failed to emit ${event} to Search Service for user ${user.userId}: ${String(err)}`);
      }
   }

   emitSearchDeleteEvent(userId: string): void {
      try {
         this.searchAdapter.emitIndexEvent(USER_EVENTS.DELETED, { userId });
      } catch (err) {
         this.logger.warn(`Failed to emit ${USER_EVENTS.DELETED} to Search Service for user ${userId}: ${String(err)}`);
      }
   }

   private async syncGraphWithFallback(user: UserEntity): Promise<void> {
      try {
         await this.userGraphSyncService.syncUserToGraph(user);
      } catch (err) {
         this.logger.warn(`Failed to sync user ${user.userId} to graph: ${String(err)}`);
         if (this.retryQueueService) {
            await this.retryQueueService.add(USER_RETRY_QUEUES.SYNC_USER_TO_GRAPH, {
               userId: user.userId,
               username: user.username,
               displayName: user.displayName,
               avatar: user.avatar,
               bio: user.bio,
               isPrivate: user.isPrivate,
               createdAt: user.createdAt,
               updatedAt: user.updatedAt,
            });
         }
      }
   }
}
