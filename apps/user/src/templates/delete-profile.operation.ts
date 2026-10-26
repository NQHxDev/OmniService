import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { PROFILE_OPERATIONS, PROFILE_OPERATION_NAMES, type ProfileOperationName } from '@user/constants';
import type { UserEntity } from '@user/entities';
import { USER_PROFILE_REPOSITORY, type IUserProfileRepository } from '@user/repositories';
import { ProfileQueryService } from '@user/services/domain/profile-query.service';
import { ProfileSyncService } from '@user/services/infrastructure/profile-sync.service';
import { AbstractProfileOperation } from '@user/templates/abstract-profile.operation';
import type { DeleteProfileContext, DeleteProfileParams } from '@user/templates/profile-operation.interface';

/**
 * Concrete Template Method implementation for User Profile Soft-Deletion.
 */
@Injectable()
export class DeleteProfileOperation extends AbstractProfileOperation<
   DeleteProfileParams,
   DeleteProfileContext,
   UserEntity
> {
   constructor(
      @Inject(USER_PROFILE_REPOSITORY)
      private readonly userProfileRepository: IUserProfileRepository,
      @Inject(forwardRef(() => ProfileQueryService))
      private readonly profileQueryService: ProfileQueryService,
      private readonly profileSyncService: ProfileSyncService,
   ) {
      super();
   }

   protected getOperationName(): ProfileOperationName {
      return PROFILE_OPERATION_NAMES.DELETE_PROFILE;
   }

   protected createContext(params: DeleteProfileParams): DeleteProfileContext {
      return {
         operation: PROFILE_OPERATIONS.UPDATE,
         startTime: Date.now(),
         userId: params.userId,
         options: params.options,
      };
   }

   protected override async beforeValidate(context: DeleteProfileContext): Promise<void> {
      const existingUser = await this.profileQueryService.getUserById(context.userId);
      context.existingUser = existingUser;
      context.accountId = existingUser.accountId;
   }

   protected async performOperation(context: DeleteProfileContext): Promise<UserEntity> {
      const targetUserId = context.existingUser?.userId ?? context.userId;
      const deletedUser = await this.userProfileRepository.softDelete(targetUserId);
      context.deletedUser = deletedUser;
      return deletedUser;
   }

   protected async syncInfrastructure(context: DeleteProfileContext, _result: UserEntity): Promise<void> {
      const targetUserId = context.existingUser?.userId ?? context.userId;
      const accountId = context.existingUser?.accountId ?? context.accountId ?? '';
      await this.profileSyncService.syncUserDeleted(targetUserId, accountId, context.existingUser ?? undefined);
   }
}
