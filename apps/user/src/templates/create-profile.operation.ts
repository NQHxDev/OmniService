import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { PROFILE_OPERATIONS, PROFILE_OPERATION_NAMES, type ProfileOperationName } from '@user/constants';
import type { UserEntity } from '@user/entities';
import { USER_PROFILE_REPOSITORY, type IUserProfileRepository } from '@user/repositories';
import { ProfileSyncService } from '@user/services/infrastructure/profile-sync.service';
import { ProfileValidationPipeline } from '@user/chains/profile-validation/profile-validation.pipeline';
import { AbstractProfileOperation } from '@user/templates/abstract-profile.operation';
import type { CreateProfileContext, CreateProfileParams } from '@user/templates/profile-operation.interface';

/**
 * Concrete Template Method implementation for User Profile Creation.
 */
@Injectable()
export class CreateProfileOperation extends AbstractProfileOperation<
   CreateProfileParams,
   CreateProfileContext,
   UserEntity
> {
   constructor(
      @Inject(USER_PROFILE_REPOSITORY)
      private readonly userProfileRepository: IUserProfileRepository,
      private readonly profileSyncService: ProfileSyncService,
      @Inject(forwardRef(() => ProfileValidationPipeline))
      private readonly profileValidationPipeline: ProfileValidationPipeline,
   ) {
      super();
   }

   protected getOperationName(): ProfileOperationName {
      return PROFILE_OPERATION_NAMES.CREATE_PROFILE;
   }

   protected createContext(params: CreateProfileParams): CreateProfileContext {
      return {
         operation: PROFILE_OPERATIONS.CREATE,
         startTime: Date.now(),
         accountId: params.accountId,
         data: params,
      };
   }

   protected override async validate(context: CreateProfileContext): Promise<void> {
      const { data } = context;
      await this.profileValidationPipeline.validate({
         operation: PROFILE_OPERATIONS.CREATE,
         accountId: data.accountId,
         username: data.username,
         displayName: data.displayName,
         bio: data.bio,
         avatar: data.avatar,
         coverImage: data.coverImage,
         website: data.website,
         location: data.location,
         dateOfBirth: data.dateOfBirth,
         gender: data.gender,
      });
   }

   protected async performOperation(context: CreateProfileContext): Promise<UserEntity> {
      const user = await this.userProfileRepository.create(context.data);
      context.createdUser = user;
      return user;
   }

   protected async syncInfrastructure(_context: CreateProfileContext, result: UserEntity): Promise<void> {
      await this.profileSyncService.syncUserCreated(result);
   }
}
