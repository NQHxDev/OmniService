import { Inject, Injectable } from '@nestjs/common';
import { NotFoundException } from '@common';
import { UserEntity } from '@user/entities';
import { USER_ERROR_CODES, UserDateOfBirthResponseDto } from '@contracts/user';
import { UserResolverService } from '@user/services/infrastructure/user-resolver.service';
import { USER_PROFILE_REPOSITORY, type IUserProfileRepository } from '@user/repositories';
import { DateOfBirth } from '@user/domain/value-objects';

/**
 * ProfileQueryService handles read-only queries and data retrieval for user profiles.
 * Adheres to the Single Responsibility Principle by decoupling queries from profile mutations.
 */
@Injectable()
export class ProfileQueryService {
   constructor(
      private readonly userResolverService: UserResolverService,
      @Inject(USER_PROFILE_REPOSITORY)
      private readonly userProfileRepository: IUserProfileRepository,
   ) {}

   async getUserById(userId: string): Promise<UserEntity> {
      return this.userResolverService.resolveUser(userId);
   }

   async getUserByAccountId(accountId: string): Promise<UserEntity> {
      return this.userResolverService.resolveByAccountId(accountId);
   }

   async getUserByUserId(userId: string): Promise<UserEntity> {
      return this.userResolverService.resolveUser(userId);
   }

   async getUserByUsername(username: string): Promise<UserEntity> {
      return this.userResolverService.resolveByUsername(username);
   }

   calculateAge(dob?: Date | string | null): number | null {
      if (!dob) {
         return null;
      }
      const dobResult = DateOfBirth.create(dob);
      if (dobResult.isFailure()) {
         return null;
      }
      return dobResult.getValue().getAge();
   }

   async getDateOfBirth(userId: string): Promise<UserDateOfBirthResponseDto> {
      const record = await this.userProfileRepository.findDateOfBirth(userId);
      if (!record) {
         throw new NotFoundException(USER_ERROR_CODES.USER_NOT_FOUND, {
            params: { userId },
         });
      }

      return {
         userId: record.userId,
         dateOfBirth: record.dateOfBirth,
         age: this.calculateAge(record.dateOfBirth),
      };
   }
}
