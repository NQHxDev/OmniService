import type { Prisma } from '@user/prisma-client';
import type { UserEntity, Gender, UserStatus } from '@user/entities';

export interface CreateUserData {
   accountId: string;
   username?: string | null;
   displayName?: string | null;
   bio?: string | null;
   avatar?: string | null;
   coverImage?: string | null;
   website?: string | null;
   location?: string | null;
   address?: string | null;
   dateOfBirth?: Date | null;
   gender?: Gender | null;
   isPrivate?: boolean;
   isVerified?: boolean;
   status?: UserStatus;
}

export interface UpdateUserData {
   username?: string;
   lastUsernameChangedAt?: Date | null;
   displayName?: string;
   bio?: string;
   avatar?: string;
   coverImage?: string;
   website?: string;
   location?: string;
   address?: string;
   dateOfBirth?: Date;
   gender?: Gender;
   isPrivate?: boolean;
   isVerified?: boolean;
   status?: UserStatus;
}

export const USER_PROFILE_REPOSITORY = Symbol('USER_PROFILE_REPOSITORY');
export const USER_REPOSITORY = USER_PROFILE_REPOSITORY;

export interface IUserProfileRepository {
   create(data: CreateUserData, tx?: Prisma.TransactionClient): Promise<UserEntity>;
   findById(userId: string): Promise<UserEntity | null>;
   findByAccountId(accountId: string): Promise<UserEntity | null>;
   findDateOfBirth(idOrAccountId: string): Promise<{ userId: string; dateOfBirth: Date | null } | null>;
   findByUsername(username: string): Promise<UserEntity | null>;
   findAllUsernames(): Promise<string[]>;
   findAll(skip?: number, take?: number): Promise<UserEntity[]>;
   count(): Promise<number>;
   findByIds(userIds: string[], status?: UserStatus): Promise<UserEntity[]>;
   findTopUsers(limit?: number, excludeUserIds?: string[], status?: UserStatus): Promise<UserEntity[]>;
   update(userId: string, data: UpdateUserData, tx?: Prisma.TransactionClient): Promise<UserEntity>;
   softDelete(userId: string, tx?: Prisma.TransactionClient): Promise<UserEntity>;
   restore(userId: string, tx?: Prisma.TransactionClient): Promise<UserEntity>;
   incrementFollowersCount(userId: string, tx?: Prisma.TransactionClient): Promise<void>;
   decrementFollowersCount(userId: string, tx?: Prisma.TransactionClient): Promise<void>;
   incrementFollowingCount(userId: string, tx?: Prisma.TransactionClient): Promise<void>;
   decrementFollowingCount(userId: string, tx?: Prisma.TransactionClient): Promise<void>;
}

// Backward-compatible alias
export type IUserRepository = IUserProfileRepository;
