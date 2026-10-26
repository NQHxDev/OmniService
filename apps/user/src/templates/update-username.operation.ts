import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { PROFILE_OPERATIONS, PROFILE_OPERATION_NAMES, type ProfileOperationName } from '@user/constants';
import type { UserEntity } from '@user/entities';
import { USER_PROFILE_REPOSITORY, type IUserProfileRepository } from '@user/repositories';
import { ProfileQueryService } from '@user/services/domain/profile-query.service';
import { ProfileSyncService } from '@user/services/infrastructure/profile-sync.service';
import { ProfileValidationPipeline } from '@user/chains/profile-validation/profile-validation.pipeline';
import { AbstractProfileOperation } from '@user/templates/abstract-profile.operation';
import type { UpdateUsernameContext, UpdateUsernameParams } from '@user/templates/profile-operation.interface';

/**
 * Concrete Template Method implementation for Username Modification.
 */
@Injectable()
export class UpdateUsernameOperation extends AbstractProfileOperation<
   UpdateUsernameParams,
   UpdateUsernameContext,
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
      return PROFILE_OPERATION_NAMES.UPDATE_USERNAME;
   }

   protected createContext(params: UpdateUsernameParams): UpdateUsernameContext {
      return {
         operation: PROFILE_OPERATIONS.UPDATE,
         startTime: Date.now(),
         userId: params.userId,
         username: params.username,
         options: params.options,
         isActorAdmin: params.options?.isActorAdmin,
      };
   }

   protected override async beforeValidate(context: UpdateUsernameContext): Promise<void> {
      const existingUser = await this.profileQueryService.getUserById(context.userId);
      context.existingUser = existingUser;

      const normalizedUsername = context.username.toLowerCase().trim();
      context.normalizedUsername = normalizedUsername;

      if (normalizedUsername === existingUser.username?.toLowerCase().trim()) {
         context.shortCircuited = true;
      }
   }

   protected override async validate(context: UpdateUsernameContext): Promise<void> {
      await this.profileValidationPipeline.validate({
         operation: PROFILE_OPERATIONS.UPDATE,
         userId: context.userId,
         username: context.username,
         existingUser: context.existingUser ?? undefined,
         isActorAdmin: context.isActorAdmin,
      });
   }

   protected async performOperation(context: UpdateUsernameContext): Promise<UserEntity> {
      const targetUserId = context.existingUser?.userId ?? context.userId;
      const updatedUser = await this.userProfileRepository.update(targetUserId, {
         username: context.username,
         lastUsernameChangedAt: new Date(),
      });
      context.updatedUser = updatedUser;
      return updatedUser;
   }

   protected async syncInfrastructure(context: UpdateUsernameContext, result: UserEntity): Promise<void> {
      await this.profileSyncService.syncUserUpdated(
         result,
         { username: context.normalizedUsername },
         context.existingUser ?? undefined,
      );
   }

   protected override extractResult(context: UpdateUsernameContext, result: UserEntity): UserEntity {
      if (context.shortCircuited && context.existingUser) {
         return context.existingUser;
      }
      return result;
   }
}
