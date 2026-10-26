import { forwardRef, HttpStatus, Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { NotFoundException } from '@common';
import { UserEntity } from '@user/entities';
import {
   USER_PROFILE_REPOSITORY,
   type IUserProfileRepository,
   type CreateUserData,
   type UpdateUserData,
} from '@user/repositories';
import { UsernameBloomFilterService } from '@user/services/infrastructure/username-bloom-filter.service';
import {
   PROFILE_OPERATION_FACTORY,
   PROFILE_OPERATION_LOG_MESSAGES,
   PROFILE_VALIDATION_PIPELINE_FACTORY,
} from '@user/constants';
import { ProfileQueryService } from '@user/services/domain/profile-query.service';
import { ProfileSyncService } from '@user/services/infrastructure/profile-sync.service';
import { ProfileValidationPipeline } from '@user/chains/profile-validation/profile-validation.pipeline';
import { ProfileValidationPipelineFactory } from '@user/factories/profile-validation-pipeline.factory';
import type { IProfileValidationPipelineFactory } from '@user/factories/profile-validation-pipeline.factory.interface';
import { ProfileOperationFactory } from '@user/factories/profile-operation.factory';
import type { IProfileOperationFactory } from '@user/factories/profile-operation.factory.interface';
import {
   CreateProfileOperation,
   UpdateProfileOperation,
   UpdateUsernameOperation,
   DeleteProfileOperation,
   RestoreProfileOperation,
   type ProfileOperationOptions,
} from '@user/templates';

/**
 * ProfileLifecycleService manages state transitions and lifecycle mutations for user profiles
 * (creation, update, upsert, username modification, deletion, and restoration).
 *
 * Implements the GoF Template Method Pattern via AbstractProfileOperation subclasses,
 * coordinating validation via the ProfileValidationPipeline Chain of Responsibility.
 */
@Injectable()
export class ProfileLifecycleService {
   private readonly logger = new Logger(ProfileLifecycleService.name);
   private readonly profileValidationPipeline: ProfileValidationPipeline;
   private readonly profileOperationFactory: IProfileOperationFactory;
   private readonly createProfileOp: CreateProfileOperation;
   private readonly updateProfileOp: UpdateProfileOperation;
   private readonly updateUsernameOp: UpdateUsernameOperation;
   private readonly deleteProfileOp: DeleteProfileOperation;
   private readonly restoreProfileOp: RestoreProfileOperation;

   constructor(
      @Inject(USER_PROFILE_REPOSITORY)
      private readonly userProfileRepository: IUserProfileRepository,
      @Inject(forwardRef(() => ProfileQueryService))
      private readonly profileQueryService: ProfileQueryService,
      private readonly usernameBloomFilterService: UsernameBloomFilterService,
      private readonly profileSyncService: ProfileSyncService,
      @Optional()
      @Inject(forwardRef(() => ProfileValidationPipeline))
      profileValidationPipeline?: ProfileValidationPipeline,
      @Optional()
      @Inject(PROFILE_VALIDATION_PIPELINE_FACTORY)
      pipelineFactory?: IProfileValidationPipelineFactory,
      @Optional()
      @Inject(PROFILE_OPERATION_FACTORY)
      operationFactory?: IProfileOperationFactory,
      @Optional()
      createProfileOp?: CreateProfileOperation,
      @Optional()
      updateProfileOp?: UpdateProfileOperation,
      @Optional()
      updateUsernameOp?: UpdateUsernameOperation,
      @Optional()
      deleteProfileOp?: DeleteProfileOperation,
      @Optional()
      restoreProfileOp?: RestoreProfileOperation,
   ) {
      const validationFactory =
         pipelineFactory ??
         new ProfileValidationPipelineFactory(
            this.profileQueryService,
            this.usernameBloomFilterService,
            this.userProfileRepository,
         );
      this.profileValidationPipeline = profileValidationPipeline ?? validationFactory.createPipeline();

      this.profileOperationFactory =
         operationFactory ??
         new ProfileOperationFactory(
            this.userProfileRepository,
            this.profileQueryService,
            this.profileSyncService,
            this.profileValidationPipeline,
         );

      this.createProfileOp = createProfileOp ?? this.profileOperationFactory.createCreateProfileOperation();
      this.updateProfileOp = updateProfileOp ?? this.profileOperationFactory.createUpdateProfileOperation();
      this.updateUsernameOp = updateUsernameOp ?? this.profileOperationFactory.createUpdateUsernameOperation();
      this.deleteProfileOp = deleteProfileOp ?? this.profileOperationFactory.createDeleteProfileOperation();
      this.restoreProfileOp = restoreProfileOp ?? this.profileOperationFactory.createRestoreProfileOperation();
   }

   async createUser(data: CreateUserData): Promise<UserEntity> {
      return this.createProfileOp.execute(data);
   }

   async updateUserProfile(
      userId: string,
      data: UpdateUserData,
      options?: ProfileOperationOptions,
   ): Promise<UserEntity> {
      return this.updateProfileOp.execute({ userId, data, options });
   }

   async upsertUserProfile(userIdOrAccountId: string, data: UpdateUserData): Promise<UserEntity> {
      try {
         return await this.updateUserProfile(userIdOrAccountId, data);
      } catch (err: unknown) {
         const isNotFound =
            err instanceof NotFoundException ||
            (typeof err === 'object' &&
               err !== null &&
               (err as { statusCode?: HttpStatus }).statusCode === HttpStatus.NOT_FOUND);

         if (isNotFound) {
            this.logger.log(`${PROFILE_OPERATION_LOG_MESSAGES.USER_NOT_FOUND_UPSERT} [${userIdOrAccountId}]`);
            return await this.createUser({
               accountId: userIdOrAccountId,
               ...data,
            });
         }
         throw err;
      }
   }

   async updateUsername(userId: string, username: string, options?: ProfileOperationOptions): Promise<UserEntity> {
      return this.updateUsernameOp.execute({ userId, username, options });
   }

   async deleteUser(userId: string): Promise<UserEntity> {
      return this.deleteProfileOp.execute({ userId });
   }

   async restoreUser(userId: string): Promise<UserEntity> {
      return this.restoreProfileOp.execute({ userId });
   }
}
