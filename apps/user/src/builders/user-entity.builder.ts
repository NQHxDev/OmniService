import { BadRequestException, type IBuilder } from '@common';
import {
   UserEntity,
   UserProfileEntity,
   UserStatsEntity,
   UserSettingsEntity,
   UserStatus,
   type UserEntityInput,
} from '@user/entities';
import { USER_BUILDER_ERRORS } from '@user/constants';
import type {
   User as PrismaUser,
   UserProfile as PrismaUserProfile,
   UserStats as PrismaUserStats,
   UserSettings as PrismaUserSettings,
} from '@user/prisma-client';

export type PrismaUserWithRelations = Partial<PrismaUser> & {
   profile?: Partial<PrismaUserProfile> | null;
   stats?: Partial<PrismaUserStats> | null;
   settings?: Partial<PrismaUserSettings> | null;
};

/**
 * Fluent builder for constructing immutable UserEntity domain representations.
 * Encapsulates nested composite entities (UserProfile, UserStats, UserSettings),
 * state transitions, and flattened convenience properties without telescoping parameters.
 */
export class UserEntityBuilder implements IBuilder<UserEntity> {
   private userId: string = '';
   private accountId: string = '';
   private username: string | null = null;
   private status: UserStatus = UserStatus.ACTIVE;
   private deletedAt: Date | null = null;
   private createdAt: Date = new Date();
   private updatedAt: Date = new Date();
   private lastActiveAt: Date | null = null;
   private lastUsernameChangedAt: Date | null = null;

   private profile: UserProfileEntity | null = null;
   private stats: UserStatsEntity | null = null;
   private settings: UserSettingsEntity | null = null;

   private displayName: string | null = null;
   private bio: string | null = null;
   private avatar: string | null = null;
   private coverImage: string | null = null;
   private website: string | null = null;
   private location: string | null = null;
   private address: string | null = null;
   private followersCount: number = 0;
   private followingCount: number = 0;
   private postsCount: number = 0;
   private recipesCount: number = 0;
   private isVerified: boolean = false;
   private isPrivate: boolean = false;

   /**
    * Static factory method to instantiate a new UserEntityBuilder.
    */
   static create(): UserEntityBuilder {
      return new UserEntityBuilder();
   }

   /**
    * Sets the unique user ID.
    */
   withUserId(userId: string): this {
      this.userId = userId;
      return this;
   }

   /**
    * Sets the associated auth account ID.
    */
   withAccountId(accountId: string): this {
      this.accountId = accountId;
      return this;
   }

   /**
    * Sets the handle/username.
    */
   withUsername(username?: string | null): this {
      this.username = username ?? null;
      return this;
   }

   /**
    * Sets the last username changed date.
    */
   withLastUsernameChangedAt(date?: Date | null): this {
      this.lastUsernameChangedAt = date ?? null;
      return this;
   }

   /**
    * Sets the account lifecycle status.
    */
   withStatus(status: UserStatus): this {
      this.status = status;
      return this;
   }

   /**
    * Marks the user as ACTIVE.
    */
   asActive(): this {
      this.status = UserStatus.ACTIVE;
      this.deletedAt = null;
      return this;
   }

   /**
    * Marks the user as SUSPENDED.
    */
   asSuspended(): this {
      this.status = UserStatus.SUSPENDED;
      return this;
   }

   /**
    * Marks the user as BLOCKED.
    */
   asBlocked(): this {
      this.status = UserStatus.BLOCKED;
      return this;
   }

   /**
    * Marks the user as soft-deleted.
    */
   asDeleted(deletedAt: Date = new Date()): this {
      this.deletedAt = deletedAt;
      return this;
   }

   /**
    * Sets lifecycle timestamps.
    */
   withTimestamps(options: {
      createdAt?: Date;
      updatedAt?: Date;
      lastActiveAt?: Date | null;
      deletedAt?: Date | null;
   }): this {
      if (options.createdAt !== undefined) this.createdAt = options.createdAt;
      if (options.updatedAt !== undefined) this.updatedAt = options.updatedAt;
      if (options.lastActiveAt !== undefined) this.lastActiveAt = options.lastActiveAt;
      if (options.deletedAt !== undefined) this.deletedAt = options.deletedAt;
      return this;
   }

   /**
    * Sets last active timestamp.
    */
   withLastActiveAt(lastActiveAt?: Date | null): this {
      this.lastActiveAt = lastActiveAt ?? null;
      return this;
   }

   /**
    * Configures profile details.
    */
   withProfile(profile?: Partial<PrismaUserProfile> | UserProfileEntity | null): this {
      if (profile) {
         this.profile = profile instanceof UserProfileEntity ? profile : new UserProfileEntity(profile);
         if (profile.displayName !== undefined) this.displayName = profile.displayName ?? null;
         if (profile.bio !== undefined) this.bio = profile.bio ?? null;
         if (profile.avatar !== undefined) this.avatar = profile.avatar ?? null;
         if (profile.coverImage !== undefined) this.coverImage = profile.coverImage ?? null;
         if (profile.website !== undefined) this.website = profile.website ?? null;
         if (profile.location !== undefined) this.location = profile.location ?? null;
         if (profile.address !== undefined) this.address = profile.address ?? null;
      } else {
         this.profile = null;
      }
      return this;
   }

   /**
    * Sets individual profile fields.
    */
   withDisplayName(displayName?: string | null): this {
      this.displayName = displayName ?? null;
      return this;
   }

   withBio(bio?: string | null): this {
      this.bio = bio ?? null;
      return this;
   }

   withAvatar(avatar?: string | null): this {
      this.avatar = avatar ?? null;
      return this;
   }

   withCoverImage(coverImage?: string | null): this {
      this.coverImage = coverImage ?? null;
      return this;
   }

   withWebsite(website?: string | null): this {
      this.website = website ?? null;
      return this;
   }

   withLocation(location?: string | null): this {
      this.location = location ?? null;
      return this;
   }

   withAddress(address?: string | null): this {
      this.address = address ?? null;
      return this;
   }

   /**
    * Configures social stats.
    */
   withStats(stats?: Partial<PrismaUserStats> | UserStatsEntity | null): this {
      if (stats) {
         this.stats = stats instanceof UserStatsEntity ? stats : new UserStatsEntity(stats);
         if (stats.followersCount !== undefined) this.followersCount = stats.followersCount ?? 0;
         if (stats.followingCount !== undefined) this.followingCount = stats.followingCount ?? 0;
         if (stats.postsCount !== undefined) this.postsCount = stats.postsCount ?? 0;
         if (stats.recipesCount !== undefined) this.recipesCount = stats.recipesCount ?? 0;
      } else {
         this.stats = null;
      }
      return this;
   }

   withFollowersCount(count: number): this {
      this.followersCount = count;
      return this;
   }

   withFollowingCount(count: number): this {
      this.followingCount = count;
      return this;
   }

   withPostsCount(count: number): this {
      this.postsCount = count;
      return this;
   }

   withRecipesCount(count: number): this {
      this.recipesCount = count;
      return this;
   }

   /**
    * Configures user settings.
    */
   withSettings(settings?: Partial<PrismaUserSettings> | UserSettingsEntity | null): this {
      if (settings) {
         this.settings = settings instanceof UserSettingsEntity ? settings : new UserSettingsEntity(settings);
         if (settings.isVerified !== undefined) this.isVerified = settings.isVerified ?? false;
         if (settings.isPrivate !== undefined) this.isPrivate = settings.isPrivate ?? false;
      } else {
         this.settings = null;
      }
      return this;
   }

   asVerified(isVerified: boolean = true): this {
      this.isVerified = isVerified;
      return this;
   }

   asPrivate(isPrivate: boolean = true): this {
      this.isPrivate = isPrivate;
      return this;
   }

   /**
    * Hydrates builder from raw UserEntityInput.
    */
   fromInput(input: Partial<UserEntityInput>): this {
      if (input.userId !== undefined) this.userId = input.userId;
      if (input.accountId !== undefined) this.accountId = input.accountId;
      if (input.username !== undefined) this.username = input.username;
      if (input.status !== undefined) this.status = input.status;
      if (input.deletedAt !== undefined) this.deletedAt = input.deletedAt;
      if (input.createdAt !== undefined) this.createdAt = input.createdAt;
      if (input.updatedAt !== undefined) this.updatedAt = input.updatedAt;
      if (input.lastActiveAt !== undefined) this.lastActiveAt = input.lastActiveAt;
      if (input.lastUsernameChangedAt !== undefined) this.lastUsernameChangedAt = input.lastUsernameChangedAt;

      if (input.profile !== undefined) {
         this.withProfile(input.profile);
      }
      if (input.stats !== undefined) {
         this.withStats(input.stats);
      }
      if (input.settings !== undefined) {
         this.withSettings(input.settings);
      }

      if (input.displayName !== undefined) this.displayName = input.displayName;
      if (input.bio !== undefined) this.bio = input.bio;
      if (input.avatar !== undefined) this.avatar = input.avatar;
      if (input.coverImage !== undefined) this.coverImage = input.coverImage;
      if (input.website !== undefined) this.website = input.website;
      if (input.location !== undefined) this.location = input.location;
      if (input.address !== undefined) this.address = input.address;

      if (input.followersCount !== undefined) this.followersCount = input.followersCount;
      if (input.followingCount !== undefined) this.followingCount = input.followingCount;
      if (input.postsCount !== undefined) this.postsCount = input.postsCount;
      if (input.recipesCount !== undefined) this.recipesCount = input.recipesCount;

      if (input.isVerified !== undefined) this.isVerified = input.isVerified;
      if (input.isPrivate !== undefined) this.isPrivate = input.isPrivate;

      return this;
   }

   /**
    * Hydrates builder from Prisma user entity with relations.
    */
   fromPrismaUser(user: PrismaUserWithRelations): this {
      return this.fromInput({
         userId: user.userId,
         accountId: user.accountId,
         username: user.username,
         status: user.status,
         deletedAt: user.deletedAt,
         createdAt: user.createdAt,
         updatedAt: user.updatedAt,
         lastActiveAt: user.lastActiveAt,
         lastUsernameChangedAt: user.lastUsernameChangedAt,
         profile: user.profile,
         stats: user.stats,
         settings: user.settings,
      });
   }

   /**
    * Constructs and returns the final validated UserEntity instance.
    * @throws BadRequestException if required identity fields are missing.
    */
   build(): UserEntity {
      if (!this.userId && !this.accountId) {
         throw new BadRequestException(USER_BUILDER_ERRORS.USER_ID_REQUIRED);
      }

      const input: UserEntityInput = {
         userId: this.userId,
         accountId: this.accountId,
         username: this.username,
         status: this.status,
         deletedAt: this.deletedAt,
         createdAt: this.createdAt,
         updatedAt: this.updatedAt,
         lastActiveAt: this.lastActiveAt,
         lastUsernameChangedAt: this.lastUsernameChangedAt,
         profile: this.profile,
         stats: this.stats,
         settings: this.settings,
         displayName: this.displayName,
         bio: this.bio,
         avatar: this.avatar,
         coverImage: this.coverImage,
         website: this.website,
         location: this.location,
         address: this.address,
         followersCount: this.followersCount,
         followingCount: this.followingCount,
         postsCount: this.postsCount,
         recipesCount: this.recipesCount,
         isVerified: this.isVerified,
         isPrivate: this.isPrivate,
      };

      return new UserEntity(input);
   }
}
