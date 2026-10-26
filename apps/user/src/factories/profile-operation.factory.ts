import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { BadRequestException, COMMON_ERROR_CODES } from '@common';
import { PROFILE_OPERATION_TYPES, type ProfileOperationType } from '@user/constants';
import { USER_PROFILE_REPOSITORY, type IUserProfileRepository } from '@user/repositories';
import { ProfileQueryService } from '@user/services/domain/profile-query.service';
import { ProfileSyncService } from '@user/services/infrastructure/profile-sync.service';
import { ProfileValidationPipeline } from '@user/chains/profile-validation/profile-validation.pipeline';
import {
   CreateProfileOperation,
   UpdateProfileOperation,
   UpdateUsernameOperation,
   DeleteProfileOperation,
   RestoreProfileOperation,
} from '@user/templates';
import type { IProfileOperationFactory } from '@user/factories/profile-operation.factory.interface';

/**
 * Factory responsible for encapsulating instantiation of profile operations (Template Method Pattern).
 * Eliminates direct operator new instantiation across consumer services.
 */
@Injectable()
export class ProfileOperationFactory implements IProfileOperationFactory {
   constructor(
      @Inject(USER_PROFILE_REPOSITORY)
      private readonly userProfileRepository: IUserProfileRepository,
      @Inject(forwardRef(() => ProfileQueryService))
      private readonly profileQueryService: ProfileQueryService,
      private readonly profileSyncService: ProfileSyncService,
      @Inject(forwardRef(() => ProfileValidationPipeline))
      private readonly profileValidationPipeline: ProfileValidationPipeline,
   ) {}

   createCreateProfileOperation(): CreateProfileOperation {
      return new CreateProfileOperation(
         this.userProfileRepository,
         this.profileSyncService,
         this.profileValidationPipeline,
      );
   }

   createUpdateProfileOperation(): UpdateProfileOperation {
      return new UpdateProfileOperation(
         this.userProfileRepository,
         this.profileQueryService,
         this.profileSyncService,
         this.profileValidationPipeline,
      );
   }

   createUpdateUsernameOperation(): UpdateUsernameOperation {
      return new UpdateUsernameOperation(
         this.userProfileRepository,
         this.profileQueryService,
         this.profileSyncService,
         this.profileValidationPipeline,
      );
   }

   createDeleteProfileOperation(): DeleteProfileOperation {
      return new DeleteProfileOperation(this.userProfileRepository, this.profileQueryService, this.profileSyncService);
   }

   createRestoreProfileOperation(): RestoreProfileOperation {
      return new RestoreProfileOperation(this.userProfileRepository, this.profileSyncService);
   }

   createOperation<T = unknown>(type: ProfileOperationType): T {
      switch (type) {
         case PROFILE_OPERATION_TYPES.CREATE_PROFILE:
            return this.createCreateProfileOperation() as unknown as T;
         case PROFILE_OPERATION_TYPES.UPDATE_PROFILE:
            return this.createUpdateProfileOperation() as unknown as T;
         case PROFILE_OPERATION_TYPES.UPDATE_USERNAME:
            return this.createUpdateUsernameOperation() as unknown as T;
         case PROFILE_OPERATION_TYPES.DELETE_PROFILE:
            return this.createDeleteProfileOperation() as unknown as T;
         case PROFILE_OPERATION_TYPES.RESTORE_PROFILE:
            return this.createRestoreProfileOperation() as unknown as T;
         default:
            throw new BadRequestException(COMMON_ERROR_CODES.INVALID_REQUEST, {
               params: { type },
            });
      }
   }
}
