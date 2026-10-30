import {
   User as PrismaUser,
   UserProfile as PrismaUserProfile,
   UserStats as PrismaUserStats,
   UserSettings as PrismaUserSettings,
   Gender,
   UserStatus,
} from '@user/prisma-client';

export class UserProfileEntity implements Omit<PrismaUserProfile, 'dateOfBirth' | 'gender'> {
   profileId: string;
   userId: string;
   displayName: string | null;
   bio: string | null;
   avatar: string | null;
   coverImage: string | null;
   website: string | null;
   location: string | null;
   address: string | null;
   createdAt: Date;
   updatedAt: Date;

   constructor(partial: Partial<PrismaUserProfile>) {
      const rest = { ...partial };
      delete (rest as { dateOfBirth?: unknown }).dateOfBirth;
      delete (rest as { gender?: unknown }).gender;

      this.profileId = rest.profileId || '';
      this.userId = rest.userId || '';
      this.displayName = rest.displayName ?? null;
      this.bio = rest.bio ?? null;
      this.avatar = rest.avatar ?? null;
      this.coverImage = rest.coverImage ?? null;
      this.website = rest.website ?? null;
      this.location = rest.location ?? null;
      this.address = rest.address ?? null;
      this.createdAt = rest.createdAt || new Date();
      this.updatedAt = rest.updatedAt || new Date();
   }
}

export class UserStatsEntity implements PrismaUserStats {
   statsId: string;
   userId: string;
   followersCount: number;
   followingCount: number;
   postsCount: number;
   recipesCount: number;
   createdAt: Date;
   updatedAt: Date;

   constructor(partial: Partial<PrismaUserStats>) {
      this.statsId = partial.statsId || '';
      this.userId = partial.userId || '';
      this.followersCount = partial.followersCount ?? 0;
      this.followingCount = partial.followingCount ?? 0;
      this.postsCount = partial.postsCount ?? 0;
      this.recipesCount = partial.recipesCount ?? 0;
      this.createdAt = partial.createdAt || new Date();
      this.updatedAt = partial.updatedAt || new Date();
   }
}

export class UserSettingsEntity implements PrismaUserSettings {
   settingsId: string;
   userId: string;
   isVerified: boolean;
   isPrivate: boolean;
   createdAt: Date;
   updatedAt: Date;

   constructor(partial: Partial<PrismaUserSettings>) {
      this.settingsId = partial.settingsId || '';
      this.userId = partial.userId || '';
      this.isVerified = partial.isVerified ?? false;
      this.isPrivate = partial.isPrivate ?? false;
      this.createdAt = partial.createdAt || new Date();
      this.updatedAt = partial.updatedAt || new Date();
   }
}

export type UserEntityInput = Partial<Omit<UserEntity, 'profile' | 'stats' | 'settings'>> & {
   dateOfBirth?: unknown;
   gender?: unknown;
   profile?: Partial<PrismaUserProfile> | UserProfileEntity | null;
   stats?: Partial<PrismaUserStats> | UserStatsEntity | null;
   settings?: Partial<PrismaUserSettings> | UserSettingsEntity | null;
};

export class UserEntity implements PrismaUser {
   userId: string;
   accountId: string;
   username: string | null;
   status: UserStatus;
   deletedAt: Date | null;
   createdAt: Date;
   updatedAt: Date;
   lastActiveAt: Date | null;
   lastUsernameChangedAt: Date | null;

   profile?: UserProfileEntity | null;
   stats?: UserStatsEntity | null;
   settings?: UserSettingsEntity | null;

   displayName: string | null;
   bio: string | null;
   avatar: string | null;
   coverImage: string | null;
   website: string | null;
   location: string | null;
   address: string | null;
   followersCount: number;
   followingCount: number;
   postsCount: number;
   recipesCount: number;
   isVerified: boolean;
   isPrivate: boolean;

   constructor(partial: UserEntityInput) {
      this.userId = partial.userId || '';
      this.accountId = partial.accountId || '';
      this.username = partial.username ?? null;
      this.status = partial.status || UserStatus.ACTIVE;
      this.deletedAt = partial.deletedAt ?? null;
      this.createdAt = partial.createdAt || new Date();
      this.updatedAt = partial.updatedAt || new Date();
      this.lastActiveAt = partial.lastActiveAt ?? null;
      this.lastUsernameChangedAt = partial.lastUsernameChangedAt ?? null;

      if (partial.profile) {
         this.profile = new UserProfileEntity(partial.profile);
      } else {
         this.profile = null;
      }

      if (partial.stats) {
         this.stats = new UserStatsEntity(partial.stats);
      } else {
         this.stats = null;
      }

      if (partial.settings) {
         this.settings = new UserSettingsEntity(partial.settings);
      } else {
         this.settings = null;
      }

      this.displayName = partial.displayName ?? this.profile?.displayName ?? null;
      this.bio = partial.bio ?? this.profile?.bio ?? null;
      this.avatar = partial.avatar ?? this.profile?.avatar ?? null;
      this.coverImage = partial.coverImage ?? this.profile?.coverImage ?? null;
      this.website = partial.website ?? this.profile?.website ?? null;
      this.location = partial.location ?? this.profile?.location ?? null;
      this.address = partial.address ?? this.profile?.address ?? null;
      this.followersCount = partial.followersCount ?? this.stats?.followersCount ?? 0;
      this.followingCount = partial.followingCount ?? this.stats?.followingCount ?? 0;
      this.postsCount = partial.postsCount ?? this.stats?.postsCount ?? 0;
      this.recipesCount = partial.recipesCount ?? this.stats?.recipesCount ?? 0;
      this.isVerified = partial.isVerified ?? this.settings?.isVerified ?? false;
      this.isPrivate = partial.isPrivate ?? this.settings?.isPrivate ?? false;
   }
}

export { Gender, UserStatus };
