import { Injectable } from '@nestjs/common';
import { type UserEntity, type Gender } from '@user/entities';
import type { CreateUserData, UpdateUserData } from '@user/repositories/user-profile.repository';
import type { UserDateOfBirthResponseDto } from '@contracts/user';
import type { UploadUrlResponseDto } from '@contracts/media';
import type { ProfileOperationOptions } from '@user/templates';
import { ProfileQueryService } from '@user/services/domain/profile-query.service';
import { ProfileLifecycleService } from '@user/services/domain/profile-lifecycle.service';
import { ProfileAvatarService } from '@user/services/domain/profile-avatar.service';

/**
 * ProfileService acts as a Facade coordinating domain profile services:
 * - ProfileQueryService: User resolution, query, and date-of-birth retrieval
 * - ProfileLifecycleService: User lifecycle mutations (create, update, upsert, delete, restore)
 * - ProfileAvatarService: Avatar uploading and direct S3/Cloudinary upload signature generation
 *
 * Adheres to the Facade Pattern (consistent with AuthCoreService in Auth Service)
 * and resolves the bloated service layer / Single Responsibility Principle violations.
 */
@Injectable()
export class ProfileService {
   constructor(
      private readonly profileQueryService: ProfileQueryService,
      private readonly profileLifecycleService: ProfileLifecycleService,
      private readonly profileAvatarService: ProfileAvatarService,
   ) {}

   /*
    -- Profile Queries & Lookups (Delegated to ProfileQueryService) --
   */

   async getUserById(userId: string): Promise<UserEntity> {
      return this.profileQueryService.getUserById(userId);
   }

   async getUserByAccountId(accountId: string): Promise<UserEntity> {
      return this.profileQueryService.getUserByAccountId(accountId);
   }

   async getUserByUserId(userId: string): Promise<UserEntity> {
      return this.profileQueryService.getUserByUserId(userId);
   }

   async getUserByUsername(username: string): Promise<UserEntity> {
      return this.profileQueryService.getUserByUsername(username);
   }

   calculateAge(dob?: Date | string | null): number | null {
      return this.profileQueryService.calculateAge(dob);
   }

   async getDateOfBirth(userId: string): Promise<UserDateOfBirthResponseDto> {
      return this.profileQueryService.getDateOfBirth(userId);
   }

   /*
    -- Profile Lifecycle & Mutations (Delegated to ProfileLifecycleService) --
   */

   async createUser(data: CreateUserData): Promise<UserEntity> {
      return this.profileLifecycleService.createUser(data);
   }

   async updateUserProfile(
      userId: string,
      data: UpdateUserData,
      options?: ProfileOperationOptions,
   ): Promise<UserEntity> {
      return this.profileLifecycleService.updateUserProfile(userId, data, options);
   }

   async upsertUserProfile(
      userIdOrAccountId: string,
      data: {
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
      },
   ): Promise<UserEntity> {
      return this.profileLifecycleService.upsertUserProfile(userIdOrAccountId, data);
   }

   async updateUsername(userId: string, username: string, options?: ProfileOperationOptions): Promise<UserEntity> {
      return this.profileLifecycleService.updateUsername(userId, username, options);
   }

   async deleteUser(userId: string): Promise<UserEntity> {
      return this.profileLifecycleService.deleteUser(userId);
   }

   async restoreUser(userId: string): Promise<UserEntity> {
      return this.profileLifecycleService.restoreUser(userId);
   }

   /*
    -- Profile Media & Avatar (Delegated to ProfileAvatarService) --
   */

   async uploadAvatar(
      userId: string,
      base64Data: string,
      mimeType?: string,
   ): Promise<{ avatarUrl: string; publicId: string; user: UserEntity }> {
      return this.profileAvatarService.uploadAvatar(userId, base64Data, mimeType);
   }

   async getAvatarUploadSignature(userId: string): Promise<UploadUrlResponseDto> {
      return this.profileAvatarService.getAvatarUploadSignature(userId);
   }
}
