import { BadRequestException, type IBuilder, type IServiceMessage } from '@common';
import { Gender, UserStatus } from '@user/entities';
import type { CreateUserData, UpdateUserData } from '@user/repositories/user-profile.repository.interface';
import { USER_BUILDER_ERRORS } from '@user/constants';

export interface UserProfileDtoSource {
   accountId?: string;
   userId?: string;
   username?: string;
   displayName?: string;
   gender?: Gender | null;
   dateOfBirth?: string | Date | number;
   bio?: string;
   avatar?: string;
   coverImage?: string;
   website?: string;
   location?: string;
   address?: string;
   isPrivate?: boolean;
   isVerified?: boolean;
   status?: UserStatus;
}

/**
 * Fluent builder for creating and transforming profile payloads (CreateUserData & UpdateUserData).
 * Encapsulates sanitization, normalization, enum casting, and Date transformations
 * across microservice transports and command pipelines.
 */
export class UserProfileDataBuilder implements IBuilder<CreateUserData> {
   private accountId?: string;
   private username?: string | null;
   private lastUsernameChangedAt?: Date | null;
   private displayName?: string | null;
   private bio?: string | null;
   private avatar?: string | null;
   private coverImage?: string | null;
   private website?: string | null;
   private location?: string | null;
   private address?: string | null;
   private dateOfBirth?: Date | null;
   private gender?: Gender | null;
   private isPrivate?: boolean;
   private isVerified?: boolean;
   private status?: UserStatus;

   /**
    * Static factory method to instantiate a new UserProfileDataBuilder.
    */
   static create(): UserProfileDataBuilder {
      return new UserProfileDataBuilder();
   }

   /**
    * Sets the account identifier.
    */
   withAccountId(accountId?: string): this {
      if (accountId) {
         this.accountId = accountId;
      }
      return this;
   }

   /**
    * Sets and normalizes the username (lowercased and trimmed).
    */
   withUsername(username?: string | null): this {
      if (username !== undefined) {
         this.username = username ? username.trim().toLowerCase() : null;
      }
      return this;
   }

   /**
    * Sets lastUsernameChangedAt timestamp.
    */
   withLastUsernameChangedAt(date?: Date | null): this {
      if (date !== undefined) {
         this.lastUsernameChangedAt = date;
      }
      return this;
   }

   /**
    * Sets display name.
    */
   withDisplayName(displayName?: string | null): this {
      if (displayName !== undefined) {
         this.displayName = displayName ?? null;
      }
      return this;
   }

   /**
    * Sets biography.
    */
   withBio(bio?: string | null): this {
      if (bio !== undefined) {
         this.bio = bio ?? null;
      }
      return this;
   }

   /**
    * Sets avatar URL.
    */
   withAvatar(avatar?: string | null): this {
      if (avatar !== undefined) {
         this.avatar = avatar ?? null;
      }
      return this;
   }

   /**
    * Sets cover image URL.
    */
   withCoverImage(coverImage?: string | null): this {
      if (coverImage !== undefined) {
         this.coverImage = coverImage ?? null;
      }
      return this;
   }

   /**
    * Sets website URL.
    */
   withWebsite(website?: string | null): this {
      if (website !== undefined) {
         this.website = website ?? null;
      }
      return this;
   }

   /**
    * Sets geographic location string.
    */
   withLocation(location?: string | null): this {
      if (location !== undefined) {
         this.location = location ?? null;
      }
      return this;
   }

   /**
    * Sets physical address string.
    */
   withAddress(address?: string | null): this {
      if (address !== undefined) {
         this.address = address ?? null;
      }
      return this;
   }

   /**
    * Sets date of birth, safely parsing strings, numbers or Date instances.
    */
   withDateOfBirth(dob?: Date | string | number | null): this {
      if (dob === null) {
         this.dateOfBirth = null;
      } else if (dob instanceof Date) {
         this.dateOfBirth = isNaN(dob.getTime()) ? null : dob;
      } else if (typeof dob === 'string' || typeof dob === 'number') {
         const parsed = new Date(dob);
         this.dateOfBirth = isNaN(parsed.getTime()) ? null : parsed;
      }
      return this;
   }

   /**
    * Sets gender using the Prisma Gender enum.
    */
   withGender(gender?: Gender | null): this {
      if (gender !== undefined) {
         this.gender = gender;
      }
      return this;
   }

   /**
    * Sets privacy setting.
    */
   asPrivate(isPrivate: boolean = true): this {
      this.isPrivate = isPrivate;
      return this;
   }

   /**
    * Sets verification status.
    */
   asVerified(isVerified: boolean = true): this {
      this.isVerified = isVerified;
      return this;
   }

   /**
    * Sets account status.
    */
   withStatus(status?: UserStatus): this {
      if (status !== undefined) {
         this.status = status;
      }
      return this;
   }

   /**
    * Populates fields from a generic DTO source.
    */
   fromDto(dto: UserProfileDtoSource): this {
      if (dto.accountId) this.withAccountId(dto.accountId);
      if (dto.userId && !this.accountId) this.withAccountId(dto.userId);

      if (dto.username !== undefined) this.withUsername(dto.username);
      if (dto.displayName !== undefined) this.withDisplayName(dto.displayName);
      if (dto.bio !== undefined) this.withBio(dto.bio);
      if (dto.avatar !== undefined) this.withAvatar(dto.avatar);
      if (dto.coverImage !== undefined) this.withCoverImage(dto.coverImage);
      if (dto.website !== undefined) this.withWebsite(dto.website);
      if (dto.location !== undefined) this.withLocation(dto.location);
      if (dto.address !== undefined) this.withAddress(dto.address);
      if (dto.gender !== undefined) this.withGender(dto.gender);
      if (dto.dateOfBirth !== undefined) this.withDateOfBirth(dto.dateOfBirth);
      if (dto.isPrivate !== undefined) this.asPrivate(dto.isPrivate);
      if (dto.isVerified !== undefined) this.asVerified(dto.isVerified);
      if (dto.status !== undefined) this.withStatus(dto.status);

      return this;
   }

   /**
    * Extracts and maps data from an incoming RMQ service message.
    */
   fromServiceMessage(
      message:
         | IServiceMessage<UserProfileDtoSource>
         | {
              data?: UserProfileDtoSource;
              user?: { userId?: string };
           },
   ): this {
      const data = message.data ?? {};
      const fallbackAccountId = data.accountId || message.user?.userId || data.userId;

      if (fallbackAccountId) {
         this.withAccountId(fallbackAccountId);
      }

      this.fromDto(data);
      return this;
   }

   /**
    * Constructs and returns the final validated CreateUserData object.
    * @throws BadRequestException if accountId is missing.
    */
   build(): CreateUserData {
      if (!this.accountId) {
         throw new BadRequestException(USER_BUILDER_ERRORS.USER_ID_REQUIRED);
      }

      return {
         accountId: this.accountId,
         username: this.username ?? null,
         displayName: this.displayName ?? null,
         bio: this.bio ?? null,
         avatar: this.avatar ?? null,
         coverImage: this.coverImage ?? null,
         website: this.website ?? null,
         location: this.location ?? null,
         address: this.address ?? null,
         dateOfBirth: this.dateOfBirth ?? null,
         gender: this.gender ?? null,
         isPrivate: this.isPrivate ?? false,
         isVerified: this.isVerified ?? false,
         ...(this.status !== undefined && { status: this.status }),
      };
   }

   /**
    * Constructs and returns an UpdateUserData payload containing only explicitly set properties.
    */
   buildUpdate(): UpdateUserData {
      const updateData: UpdateUserData = {};

      if (this.username !== undefined && this.username !== null) updateData.username = this.username;
      if (this.lastUsernameChangedAt !== undefined) updateData.lastUsernameChangedAt = this.lastUsernameChangedAt;
      if (this.displayName !== undefined && this.displayName !== null) updateData.displayName = this.displayName;
      if (this.bio !== undefined && this.bio !== null) updateData.bio = this.bio;
      if (this.avatar !== undefined && this.avatar !== null) updateData.avatar = this.avatar;
      if (this.coverImage !== undefined && this.coverImage !== null) updateData.coverImage = this.coverImage;
      if (this.website !== undefined && this.website !== null) updateData.website = this.website;
      if (this.location !== undefined && this.location !== null) updateData.location = this.location;
      if (this.address !== undefined && this.address !== null) updateData.address = this.address;
      if (this.dateOfBirth !== undefined && this.dateOfBirth !== null) updateData.dateOfBirth = this.dateOfBirth;
      if (this.gender !== undefined && this.gender !== null) updateData.gender = this.gender;
      if (this.isPrivate !== undefined) updateData.isPrivate = this.isPrivate;
      if (this.isVerified !== undefined) updateData.isVerified = this.isVerified;
      if (this.status !== undefined) updateData.status = this.status;

      return updateData;
   }
}
