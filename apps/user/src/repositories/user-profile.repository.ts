import { Inject, Injectable } from '@nestjs/common';
import { uuidv7 } from '@common';
import { PrismaService, type PrismaClientOrTransaction } from '@user/prisma';
import { UserEntity, UserStatus } from '@user/entities';
import { UserEntityBuilder } from '@user/builders';
import type { Prisma, User, UserProfile, UserStats, UserSettings } from '@user/prisma-client';
import type {
   CreateUserData,
   UpdateUserData,
   IUserProfileRepository,
} from '@user/repositories/user-profile.repository.interface';

export * from '@user/repositories/user-profile.repository.interface';

type UserWithRelations = User & {
   profile?: UserProfile | null;
   stats?: UserStats | null;
   settings?: UserSettings | null;
};

const userIncludeRelations = {
   profile: true,
   stats: true,
   settings: true,
} as const;

@Injectable()
export class UserProfileRepository implements IUserProfileRepository {
   constructor(@Inject(PrismaService) private readonly prisma: PrismaClientOrTransaction) {}

   private toEntity(user: UserWithRelations): UserEntity {
      return UserEntityBuilder.create().fromPrismaUser(user).build();
   }

   async create(data: CreateUserData, tx?: Prisma.TransactionClient): Promise<UserEntity> {
      const client = tx ?? this.prisma;
      const user = await client.user.create({
         data: {
            userId: uuidv7(),
            accountId: data.accountId,
            username: data.username,
            status: data.status ?? UserStatus.ACTIVE,
            profile: {
               create: {
                  profileId: uuidv7(),
                  displayName: data.displayName,
                  bio: data.bio,
                  avatar: data.avatar,
                  coverImage: data.coverImage,
                  website: data.website,
                  location: data.location,
                  address: data.address,
                  dateOfBirth: data.dateOfBirth,
                  gender: data.gender,
               },
            },
            stats: {
               create: {
                  statsId: uuidv7(),
               },
            },
            settings: {
               create: {
                  settingsId: uuidv7(),
                  isPrivate: data.isPrivate ?? false,
                  isVerified: data.isVerified ?? false,
               },
            },
         },
         include: userIncludeRelations,
      });

      return this.toEntity(user);
   }

   async findById(userId: string): Promise<UserEntity | null> {
      const user = await this.prisma.user.findFirst({
         where: {
            userId,
            deletedAt: null,
         },
         include: userIncludeRelations,
      });
      return user ? this.toEntity(user) : null;
   }

   async findByAccountId(accountId: string): Promise<UserEntity | null> {
      const user = await this.prisma.user.findFirst({
         where: {
            accountId,
            deletedAt: null,
         },
         include: userIncludeRelations,
      });
      return user ? this.toEntity(user) : null;
   }

   async findDateOfBirth(idOrAccountId: string): Promise<{ userId: string; dateOfBirth: Date | null } | null> {
      const user = await this.prisma.user.findFirst({
         where: {
            OR: [{ userId: idOrAccountId }, { accountId: idOrAccountId }],
            deletedAt: null,
         },
         select: {
            userId: true,
            accountId: true,
            profile: {
               select: {
                  dateOfBirth: true,
               },
            },
         },
      });

      if (!user) {
         return null;
      }

      return {
         userId: user.userId,
         dateOfBirth: user.profile?.dateOfBirth ?? null,
      };
   }

   async findByUsername(username: string): Promise<UserEntity | null> {
      const user = await this.prisma.user.findFirst({
         where: {
            username,
            deletedAt: null,
         },
         include: userIncludeRelations,
      });
      return user ? this.toEntity(user) : null;
   }

   async findAllUsernames(): Promise<string[]> {
      const users = await this.prisma.user.findMany({
         where: {
            deletedAt: null,
            username: { not: null },
         },
         select: {
            username: true,
         },
      });
      return users.map((u) => u.username!).filter(Boolean);
   }

   async findAll(skip = 0, take = 50): Promise<UserEntity[]> {
      const users = await this.prisma.user.findMany({
         where: { deletedAt: null },
         skip,
         take,
         include: userIncludeRelations,
      });
      return users.map((user) => this.toEntity(user));
   }

   async count(): Promise<number> {
      return this.prisma.user.count({
         where: { deletedAt: null },
      });
   }

   async findByIds(userIds: string[], status?: UserStatus): Promise<UserEntity[]> {
      if (!userIds || userIds.length === 0) {
         return [];
      }
      const users = await this.prisma.user.findMany({
         where: {
            userId: { in: userIds },
            deletedAt: null,
            ...(status !== undefined && { status }),
         },
         include: userIncludeRelations,
      });
      return users.map((user) => this.toEntity(user));
   }

   async findTopUsers(
      limit = 10,
      excludeUserIds: string[] = [],
      status: UserStatus = UserStatus.ACTIVE,
   ): Promise<UserEntity[]> {
      const users = await this.prisma.user.findMany({
         where: {
            deletedAt: null,
            status,
            ...(excludeUserIds.length > 0 && {
               userId: { notIn: excludeUserIds },
            }),
         },
         take: limit,
         orderBy: [{ stats: { followersCount: 'desc' } }, { createdAt: 'desc' }],
         include: userIncludeRelations,
      });
      return users.map((user) => this.toEntity(user));
   }

   async update(userId: string, data: UpdateUserData, tx?: Prisma.TransactionClient): Promise<UserEntity> {
      const client = tx ?? this.prisma;
      const {
         username,
         status,
         displayName,
         bio,
         avatar,
         coverImage,
         website,
         location,
         dateOfBirth,
         gender,
         isPrivate,
         isVerified,
      } = data;

      const profileUpdates = {
         ...(displayName !== undefined && { displayName }),
         ...(bio !== undefined && { bio }),
         ...(avatar !== undefined && { avatar }),
         ...(coverImage !== undefined && { coverImage }),
         ...(website !== undefined && { website }),
         ...(location !== undefined && { location }),
         ...(data.address !== undefined && { address: data.address }),
         ...(dateOfBirth !== undefined && { dateOfBirth }),
         ...(gender !== undefined && { gender }),
      };

      const settingsUpdates = {
         ...(isPrivate !== undefined && { isPrivate }),
         ...(isVerified !== undefined && { isVerified }),
      };

      const user = await client.user.update({
         where: { userId },
         data: {
            ...(username !== undefined && { username }),
            ...(data.lastUsernameChangedAt !== undefined && { lastUsernameChangedAt: data.lastUsernameChangedAt }),
            ...(status !== undefined && { status }),
            ...(Object.keys(profileUpdates).length > 0 && {
               profile: {
                  upsert: {
                     create: profileUpdates,
                     update: profileUpdates,
                  },
               },
            }),
            ...(Object.keys(settingsUpdates).length > 0 && {
               settings: {
                  upsert: {
                     create: settingsUpdates,
                     update: settingsUpdates,
                  },
               },
            }),
         },
         include: userIncludeRelations,
      });

      return this.toEntity(user);
   }

   async softDelete(userId: string, tx?: Prisma.TransactionClient): Promise<UserEntity> {
      const client = tx ?? this.prisma;
      const user = await client.user.update({
         where: { userId },
         data: { deletedAt: new Date() },
         include: userIncludeRelations,
      });
      return this.toEntity(user);
   }

   async restore(userId: string, tx?: Prisma.TransactionClient): Promise<UserEntity> {
      const client = tx ?? this.prisma;
      const user = await client.user.update({
         where: { userId },
         data: { deletedAt: null },
         include: userIncludeRelations,
      });
      return this.toEntity(user);
   }

   async incrementFollowersCount(userId: string, tx?: Prisma.TransactionClient): Promise<void> {
      const client = tx ?? this.prisma;
      await client.userStats.upsert({
         where: { userId },
         update: { followersCount: { increment: 1 } },
         create: { userId, followersCount: 1 },
      });
   }

   async decrementFollowersCount(userId: string, tx?: Prisma.TransactionClient): Promise<void> {
      const client = tx ?? this.prisma;
      await client.userStats.upsert({
         where: { userId },
         update: { followersCount: { decrement: 1 } },
         create: { userId, followersCount: 0 },
      });
   }

   async incrementFollowingCount(userId: string, tx?: Prisma.TransactionClient): Promise<void> {
      const client = tx ?? this.prisma;
      await client.userStats.upsert({
         where: { userId },
         update: { followingCount: { increment: 1 } },
         create: { userId, followingCount: 1 },
      });
   }

   async decrementFollowingCount(userId: string, tx?: Prisma.TransactionClient): Promise<void> {
      const client = tx ?? this.prisma;
      await client.userStats.upsert({
         where: { userId },
         update: { followingCount: { decrement: 1 } },
         create: { userId, followingCount: 0 },
      });
   }
}

// Backward compatible alias
export { UserProfileRepository as UserRepository };
