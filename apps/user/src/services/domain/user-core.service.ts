import { Injectable, Optional } from '@nestjs/common';
import { COMMON_ERROR_CODES, InternalServerException } from '@common';
import type { UploadUrlResponseDto } from '@contracts/media';
import type { UserDateOfBirthResponseDto, UserSearchResponseDto, UserSuggestionItemDto } from '@contracts/user';
import { type FollowEntity, type FollowStatus, type Gender, type UserEntity } from '@user/entities';
import type { CreateUserData } from '@user/repositories/user-profile.repository';
import { ProfileService } from '@user/services/domain/profile.service';
import { FollowService, type FollowOperationOptions } from '@user/services/domain/follow.service';
import { UserSearchService } from '@user/services/domain/user-search.service';
import { AuthService } from '@user/services/domain/auth.service';
import {
   UserActivityProjection,
   type UserActivitySummaryResult,
   UserProfileProjection,
   type UserProfileProjectionData,
   UserStatsProjection,
   type UserStatsResult,
} from '@user/cqrs/read';
import {
   UserProjectionRebuildService,
   type RebuildProjectionsOptions,
   type RebuildProjectionsResult,
} from '@user/cqrs/services/user-projection-rebuild.service';

export interface UpdateUserProfileData {
   username?: string;
   displayName?: string;
   bio?: string;
   avatar?: string;
   coverImage?: string;
   website?: string;
   location?: string;
   address?: string;
   dateOfBirth?: Date;
   gender?: Gender;
}

/**
 * UserCoreService acts as a Facade coordinating domain services across the User subsystem:
 * - ProfileService: User identity queries, profile lifecycle mutations, and avatar handling
 * - FollowService: Follow relationships, graph sync, requests, and friend recommendations
 * - UserSearchService: Elasticsearch inverted-index search and typo-tolerant discovery
 * - AuthService: Username bloom-filter availability and user registration sync
 * - CQRS Projections & Rebuild: Read model projections for UserStats, UserProfile, UserActivity
 *
 * Adheres strictly to the Facade Pattern (consistent with AuthCoreService in Auth Service)
 * providing a centralized, unified entry point for all User domain operations.
 */
@Injectable()
export class UserCoreService {
   constructor(
      private readonly profileService: ProfileService,
      private readonly followService: FollowService,
      private readonly userSearchService: UserSearchService,
      private readonly authService: AuthService,
      @Optional()
      private readonly userStatsProjection?: UserStatsProjection,
      @Optional()
      private readonly userProfileProjection?: UserProfileProjection,
      @Optional()
      private readonly userActivityProjection?: UserActivityProjection,
      @Optional()
      private readonly rebuildService?: UserProjectionRebuildService,
   ) {}

   /*
    -- Profile Queries & Lookups (Delegated to ProfileService) --
   */

   async getUserById(userId: string): Promise<UserEntity> {
      return this.profileService.getUserById(userId);
   }

   async getUserByAccountId(accountId: string): Promise<UserEntity> {
      return this.profileService.getUserByAccountId(accountId);
   }

   async getUserByUserId(userId: string): Promise<UserEntity> {
      return this.profileService.getUserByUserId(userId);
   }

   async getUserByUsername(username: string): Promise<UserEntity> {
      return this.profileService.getUserByUsername(username);
   }

   calculateAge(dob?: Date | string | null): number | null {
      return this.profileService.calculateAge(dob);
   }

   async getDateOfBirth(userId: string): Promise<UserDateOfBirthResponseDto> {
      return this.profileService.getDateOfBirth(userId);
   }

   /*
    -- Profile Lifecycle & Mutations (Delegated to ProfileService) --
   */

   async createUser(data: CreateUserData): Promise<UserEntity> {
      return this.profileService.createUser(data);
   }

   async updateUserProfile(userId: string, data: UpdateUserProfileData): Promise<UserEntity> {
      return this.profileService.updateUserProfile(userId, data);
   }

   async upsertUserProfile(userIdOrAccountId: string, data: UpdateUserProfileData): Promise<UserEntity> {
      return this.profileService.upsertUserProfile(userIdOrAccountId, data);
   }

   async updateUsername(userId: string, username: string): Promise<UserEntity> {
      return this.profileService.updateUsername(userId, username);
   }

   async deleteUser(userId: string): Promise<UserEntity> {
      return this.profileService.deleteUser(userId);
   }

   async restoreUser(userId: string): Promise<UserEntity> {
      return this.profileService.restoreUser(userId);
   }

   /*
    -- Avatar & Direct Upload Signatures (Delegated to ProfileService) --
   */

   async uploadAvatar(
      userId: string,
      fileBase64: string,
      mimeType?: string,
   ): Promise<{ avatarUrl: string; publicId: string; user: UserEntity }> {
      return this.profileService.uploadAvatar(userId, fileBase64, mimeType);
   }

   async getAvatarUploadSignature(userId: string): Promise<UploadUrlResponseDto> {
      return this.profileService.getAvatarUploadSignature(userId);
   }

   /*
    -- Social Graph & Follow Operations (Delegated to FollowService) --
   */

   async followUser(followerId: string, followingId: string, options?: FollowOperationOptions): Promise<FollowEntity> {
      return this.followService.followUser(followerId, followingId, options);
   }

   async unfollowUser(followerId: string, followingId: string, options?: FollowOperationOptions): Promise<void> {
      return this.followService.unfollowUser(followerId, followingId, options);
   }

   async acceptFollowRequest(followId: string): Promise<FollowEntity> {
      return this.followService.acceptFollowRequest(followId);
   }

   async rejectFollowRequest(followId: string, options?: FollowOperationOptions): Promise<FollowEntity> {
      return this.followService.rejectFollowRequest(followId, options);
   }

   async getFollowers(userId: string, status?: FollowStatus, skip?: number, take?: number): Promise<FollowEntity[]> {
      return this.followService.getFollowers(userId, status, skip, take);
   }

   async getFollowing(userId: string, status?: FollowStatus, skip?: number, take?: number): Promise<FollowEntity[]> {
      return this.followService.getFollowing(userId, status, skip, take);
   }

   async getFollowersCount(userId: string, status?: FollowStatus): Promise<number> {
      return this.followService.getFollowersCount(userId, status);
   }

   async getFollowingCount(userId: string, status?: FollowStatus): Promise<number> {
      return this.followService.getFollowingCount(userId, status);
   }

   async getMutualFollowers(userId1: string, userId2: string): Promise<string[]> {
      return this.followService.getMutualFollowers(userId1, userId2);
   }

   async getFollowSuggestions(userId: string, limit?: number): Promise<UserSuggestionItemDto[]> {
      return this.followService.getFollowSuggestions(userId, limit);
   }

   /*
    -- Search & Discovery (Delegated to UserSearchService) --
   */

   async searchUsers(
      query: string,
      limit?: number,
      cursor?: string,
      currentUserId?: string,
   ): Promise<UserSearchResponseDto> {
      return this.userSearchService.searchUsers(query, limit, cursor, currentUserId);
   }

   /*
    -- Authentication & Account Sync (Delegated to AuthService) --
   */

   async checkUsername(username: string): Promise<{ available: boolean; username: string }> {
      return this.authService.checkUsername(username);
   }

   async handleUserRegistered(data: { accountId: string; email?: string }): Promise<UserEntity | null> {
      return this.authService.handleUserRegistered(data);
   }

   /*
    -- CQRS Event Store & Read Model Projections --
   */

   async getUserStats(userId: string): Promise<UserStatsResult | null> {
      return this.userStatsProjection ? this.userStatsProjection.getUserStats(userId) : null;
   }

   async getUserProfileProjection(userId: string): Promise<UserProfileProjectionData | null> {
      return this.userProfileProjection ? this.userProfileProjection.getProfile(userId) : null;
   }

   async getUserActivitySummary(userId: string): Promise<UserActivitySummaryResult | null> {
      return this.userActivityProjection ? this.userActivityProjection.getActivitySummary(userId) : null;
   }

   async rebuildProjections(options?: RebuildProjectionsOptions): Promise<RebuildProjectionsResult> {
      if (!this.rebuildService) {
         throw new InternalServerException(COMMON_ERROR_CODES.INTERNAL_SERVER_ERROR);
      }
      return this.rebuildService.rebuildAll(options);
   }
}
