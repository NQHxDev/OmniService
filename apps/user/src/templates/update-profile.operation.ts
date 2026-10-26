import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { PROFILE_OPERATIONS, PROFILE_OPERATION_NAMES, type ProfileOperationName } from '@user/constants';
import type { UserEntity } from '@user/entities';
import { USER_PROFILE_REPOSITORY, type IUserProfileRepository } from '@user/repositories';
import { ProfileQueryService } from '@user/services/domain/profile-query.service';
import { ProfileSyncService } from '@user/services/infrastructure/profile-sync.service';
import { ProfileValidationPipeline } from '@user/chains/profile-validation/profile-validation.pipeline';
import { AbstractProfileOperation } from '@user/templates/abstract-profile.operation';
import type { UpdateProfileContext, UpdateProfileParams } from '@user/templates/profile-operation.interface';

/**
 * Concrete Template Method implementation for User Profile Updates.
 */
@Injectable()
export class UpdateProfileOperation extends AbstractProfileOperation<
   UpdateProfileParams,
   UpdateProfileContext,
   UserEntity
> {
   constructor(
      @Inject(USER_PROFILE_REPOSITORY)
      private readonly userProfileRepository: IUserProfileRepository,
      @Inject(forwardRef(() => ProfileQueryService))
      private readonly profileQueryService: ProfileQueryService,
      private readonly profileSyncService: ProfileSyncService,
      @Inject(forwardRef(() => ProfileValidationPipeline))
      private readonly profileValidationPipeline: ProfileValidationPipeline,
   ) {
      super();
   }

   protected getOperationName(): ProfileOperationName {
      return PROFILE_OPERATION_NAMES.UPDATE_PROFILE;
   }

   protected createContext(params: UpdateProfileParams): UpdateProfileContext {
      return {
         operation: PROFILE_OPERATIONS.UPDATE,
         startTime: Date.now(),
         userId: params.userId,
         data: params.data,
         options: params.options,
         isActorAdmin: params.options?.isActorAdmin,
      };
   }

   protected override async beforeValidate(context: UpdateProfileContext): Promise<void> {
      const existingUser = await this.profileQueryService.getUserById(context.userId);
      context.existingUser = existingUser;
   }

   protected override async validate(context: UpdateProfileContext): Promise<void> {
      const { data, existingUser, userId } = context;
      await this.profileValidationPipeline.validate({
         operation: PROFILE_OPERATIONS.UPDATE,
         userId,
         username: data.username,
         displayName: data.displayName,
         bio: data.bio,
         avatar: data.avatar,
         coverImage: data.coverImage,
         website: data.website,
         location: data.location,
         dateOfBirth: data.dateOfBirth,
         gender: data.gender,
         existingUser: existingUser ?? undefined,
         isActorAdmin: context.isActorAdmin,
      });
   }

   protected async performOperation(context: UpdateProfileContext): Promise<UserEntity> {
      const targetUserId = context.existingUser?.userId ?? context.userId;
      if (
         context.data.username &&
         context.data.username.toLowerCase().trim() !== context.existingUser?.username?.toLowerCase().trim()
      ) {
         context.data.lastUsernameChangedAt = new Date();
      }
      const updatedUser = await this.userProfileRepository.update(targetUserId, context.data);
      context.updatedUser = updatedUser;
      return updatedUser;
   }

   protected async syncInfrastructure(context: UpdateProfileContext, result: UserEntity): Promise<void> {
      await this.profileSyncService.syncUserUpdated(result, context.data, context.existingUser ?? undefined);
   }
}
