import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RetryQueueService } from '@common';
import { USER_SUGGESTION_REASONS, UserSuggestionItemDto } from '@contracts/user';
import { FollowEntity, FollowStatus, UserEntity, UserStatus } from '@user/entities';
import { FollowEntityBuilder } from '@user/builders';
import type { IUserProfileRepository } from '@user/repositories/user-profile.repository.interface';
import { USER_PROFILE_REPOSITORY } from '@user/repositories/user-profile.repository.interface';
import {
   FOLLOW_REPOSITORY,
   GRAPH_FOLLOW_REPOSITORY,
   type IFollowRepository,
   type IFollowGraphRepository,
} from '@user/repositories';
import { UserResolverService } from '@user/services/infrastructure/user-resolver.service';
import { UNIT_OF_WORK, type IUnitOfWork } from '@user/unit-of-work';
import { CannotFollowSelfSpecification, FollowRequestPendingSpecification } from '@user/domain/specifications';
import { USER_DOMAIN_EVENTS } from '@user/domain/events';
import {
   FollowUserSaga,
   UnfollowUserSaga,
   AcceptFollowRequestSaga,
   RejectFollowRequestSaga,
   type FollowOperationOptions,
} from '@user/sagas/follow';
import {
   FOLLOW_OPERATIONS,
   FOLLOW_SAGA_FACTORY,
   FOLLOW_VALIDATION_PIPELINE_FACTORY,
   USER_DOMAIN_EVENT_FACTORY,
   USER_SPECIFICATION_FACTORY,
} from '@user/constants';
import {
   FollowSagaFactory,
   FollowValidationPipelineFactory,
   UserDomainEventFactory,
   UserSpecificationFactory,
   type IFollowSagaFactory,
   type IFollowValidationPipelineFactory,
   type IUserDomainEventFactory,
   type IUserSpecificationFactory,
} from '@user/factories';
import { FollowValidationPipeline, type FollowValidationContext } from '@user/chains/follow-validation';

export type { FollowOperationOptions };

@Injectable()
export class FollowService {
   private readonly logger = new Logger(FollowService.name);
   private readonly followSagaFactory: IFollowSagaFactory;
   private readonly followValidationPipelineFactory: IFollowValidationPipelineFactory;
   private readonly followValidationPipeline: FollowValidationPipeline;
   private readonly domainEventFactory: IUserDomainEventFactory;
   private readonly cannotFollowSelfSpec: CannotFollowSelfSpecification;
   private readonly followRequestPendingSpec: FollowRequestPendingSpecification;
   private readonly followUserSaga: FollowUserSaga;
   private readonly unfollowUserSaga: UnfollowUserSaga;
   private readonly acceptFollowRequestSaga: AcceptFollowRequestSaga;
   private readonly rejectFollowRequestSaga: RejectFollowRequestSaga;

   constructor(
      @Inject(USER_PROFILE_REPOSITORY)
      private readonly userProfileRepository: IUserProfileRepository,
      private readonly userResolverService: UserResolverService,
      @Inject(FOLLOW_REPOSITORY)
      private readonly followRepository: IFollowRepository,
      @Inject(GRAPH_FOLLOW_REPOSITORY)
      private readonly graphFollowRepository: IFollowGraphRepository,
      @Inject(UNIT_OF_WORK)
      private readonly unitOfWork: IUnitOfWork,
      @Optional()
      private readonly retryQueueService?: RetryQueueService,
      @Optional()
      @Inject(USER_SPECIFICATION_FACTORY)
      specificationFactory?: IUserSpecificationFactory,
      @Optional()
      private readonly eventEmitter?: EventEmitter2,
      @Optional()
      followUserSaga?: FollowUserSaga,
      @Optional()
      unfollowUserSaga?: UnfollowUserSaga,
      @Optional()
      acceptFollowRequestSaga?: AcceptFollowRequestSaga,
      @Optional()
      rejectFollowRequestSaga?: RejectFollowRequestSaga,
      @Optional()
      @Inject(FOLLOW_SAGA_FACTORY)
      followSagaFactory?: IFollowSagaFactory,
      @Optional()
      @Inject(USER_DOMAIN_EVENT_FACTORY)
      domainEventFactory?: IUserDomainEventFactory,
      @Optional()
      followValidationPipeline?: FollowValidationPipeline,
      @Optional()
      @Inject(FOLLOW_VALIDATION_PIPELINE_FACTORY)
      followValidationPipelineFactory?: IFollowValidationPipelineFactory,
   ) {
      this.followSagaFactory =
         followSagaFactory ??
         new FollowSagaFactory(this.unitOfWork, this.graphFollowRepository, this.retryQueueService);
      this.domainEventFactory = domainEventFactory ?? new UserDomainEventFactory();
      const specFactory = specificationFactory ?? new UserSpecificationFactory();
      this.cannotFollowSelfSpec = specFactory.createCannotFollowSelfSpecification();
      this.followRequestPendingSpec = specFactory.createFollowRequestPendingSpecification();

      this.followValidationPipelineFactory =
         followValidationPipelineFactory ??
         new FollowValidationPipelineFactory(
            this.userResolverService,
            this.followRepository,
            this.graphFollowRepository,
            specFactory,
         );
      this.followValidationPipeline = followValidationPipeline ?? this.followValidationPipelineFactory.createPipeline();

      this.followUserSaga = followUserSaga ?? this.followSagaFactory.createFollowUserSaga();
      this.unfollowUserSaga = unfollowUserSaga ?? this.followSagaFactory.createUnfollowUserSaga();
      this.acceptFollowRequestSaga = acceptFollowRequestSaga ?? this.followSagaFactory.createAcceptFollowRequestSaga();
      this.rejectFollowRequestSaga = rejectFollowRequestSaga ?? this.followSagaFactory.createRejectFollowRequestSaga();
   }

   private async getUserById(userId: string): Promise<UserEntity> {
      return this.userResolverService.resolveUser(userId);
   }

   async followUser(followerId: string, followingId: string, options?: FollowOperationOptions): Promise<FollowEntity> {
      const context: FollowValidationContext = {
         operation: FOLLOW_OPERATIONS.FOLLOW,
         followerId,
         followingId,
         options,
      };

      await this.followValidationPipeline.validate(context);

      const follower = context.follower!;
      const following = context.following!;
      const status = context.status!;

      const follow = await this.followUserSaga.execute({
         follower,
         following,
         status,
         options,
      });

      if (this.eventEmitter) {
         this.eventEmitter.emit(
            USER_DOMAIN_EVENTS.USER_FOLLOWED,
            this.domainEventFactory.createUserFollowed(follow.followId, follower.userId, following.userId, status),
         );
      }

      return follow;
   }

   async unfollowUser(followerId: string, followingId: string, options?: FollowOperationOptions): Promise<void> {
      const context: FollowValidationContext = {
         operation: FOLLOW_OPERATIONS.UNFOLLOW,
         followerId,
         followingId,
         options,
      };

      await this.followValidationPipeline.validate(context);

      const follower = context.follower!;
      const following = context.following!;
      const follow = context.follow!;

      await this.unfollowUserSaga.execute({
         follower,
         following,
         follow,
         options,
      });

      if (this.eventEmitter) {
         this.eventEmitter.emit(
            USER_DOMAIN_EVENTS.USER_UNFOLLOWED,
            this.domainEventFactory.createUserUnfollowed(follower.userId, following.userId),
         );
      }
   }

   async acceptFollowRequest(followId: string, options?: FollowOperationOptions): Promise<FollowEntity> {
      const context: FollowValidationContext = {
         operation: FOLLOW_OPERATIONS.ACCEPT_REQUEST,
         followId,
         options,
      };

      await this.followValidationPipeline.validate(context);

      const follow = context.follow!;

      const updatedFollow = await this.acceptFollowRequestSaga.execute({
         follow,
         options,
      });

      if (this.eventEmitter) {
         this.eventEmitter.emit(
            USER_DOMAIN_EVENTS.FOLLOW_REQUEST_ACCEPTED,
            this.domainEventFactory.createFollowRequestAccepted(follow.followId, follow.followerId, follow.followingId),
         );
      }

      return updatedFollow;
   }

   async rejectFollowRequest(followId: string, options?: FollowOperationOptions): Promise<FollowEntity> {
      const context: FollowValidationContext = {
         operation: FOLLOW_OPERATIONS.REJECT_REQUEST,
         followId,
         options,
      };

      await this.followValidationPipeline.validate(context);

      const follow = context.follow!;

      const updatedFollow = await this.rejectFollowRequestSaga.execute({
         follow,
         options,
      });

      if (this.eventEmitter) {
         this.eventEmitter.emit(
            USER_DOMAIN_EVENTS.FOLLOW_REQUEST_REJECTED,
            this.domainEventFactory.createFollowRequestRejected(follow.followId, follow.followerId, follow.followingId),
         );
      }

      return updatedFollow;
   }

   async checkIsFollowing(
      followerId: string,
      followingId: string,
   ): Promise<{ isFollowing: boolean; status?: FollowStatus }> {
      const follower = await this.getUserById(followerId);
      const following = await this.getUserById(followingId);

      const inGraph = await this.graphFollowRepository.findFollow(follower.userId, following.userId);
      if (inGraph) {
         return { isFollowing: true, status: FollowStatus.ACCEPTED };
      }

      const follow = await this.followRepository.findByFollowerAndFollowing(follower.userId, following.userId);
      if (follow) {
         return {
            isFollowing: follow.status === FollowStatus.ACCEPTED,
            status: follow.status,
         };
      }

      return { isFollowing: false };
   }

   async getFollowers(userId: string, status?: FollowStatus, skip = 0, take = 20): Promise<FollowEntity[]> {
      const user = await this.getUserById(userId);

      const graphResults = await this.graphFollowRepository.getFollowers(user.userId, status, skip, take);

      return graphResults.map((result) => FollowEntityBuilder.create().fromGraphResult(result).build());
   }

   async getFollowing(userId: string, status?: FollowStatus, skip = 0, take = 20): Promise<FollowEntity[]> {
      const user = await this.getUserById(userId);

      const graphResults = await this.graphFollowRepository.getFollowing(user.userId, status, skip, take);

      return graphResults.map((result) => FollowEntityBuilder.create().fromGraphResult(result).build());
   }

   async getFollowersCount(userId: string, status?: FollowStatus): Promise<number> {
      const user = await this.getUserById(userId);
      return this.graphFollowRepository.countFollowers(user.userId, status);
   }

   async getFollowingCount(userId: string, status?: FollowStatus): Promise<number> {
      const user = await this.getUserById(userId);
      return this.graphFollowRepository.countFollowing(user.userId, status);
   }

   async getMutualFollowers(userId1: string, userId2: string): Promise<string[]> {
      const user1 = await this.getUserById(userId1);
      const user2 = await this.getUserById(userId2);
      return this.graphFollowRepository.getMutualFollowers(user1.userId, user2.userId);
   }

   async getFollowSuggestions(userId: string, limit = 10): Promise<UserSuggestionItemDto[]> {
      const user = await this.getUserById(userId);

      const followingList = await this.followRepository.findFollowing(user.userId, FollowStatus.ACCEPTED, 0, 1000);
      const alreadyFollowingIds = new Set(followingList.map((f) => f.followingId));
      alreadyFollowingIds.add(user.userId);

      let graphCandidateIds: string[] = [];
      try {
         const rawGraphIds = await this.graphFollowRepository.getFollowSuggestions(user.userId, limit * 2);
         graphCandidateIds = rawGraphIds.filter((userId) => !alreadyFollowingIds.has(userId));
      } catch (err) {
         this.logger.warn(`Failed to retrieve graph follow suggestions for ${user.userId}: ${String(err)}`);
      }

      const selectedGraphIds = Array.from(new Set(graphCandidateIds)).slice(0, limit);
      const graphIdSet = new Set(selectedGraphIds);

      let popularUsers: UserEntity[] = [];
      const neededCount = limit - selectedGraphIds.length;
      if (neededCount > 0) {
         const excludeIds = Array.from(new Set([...alreadyFollowingIds, ...selectedGraphIds]));
         popularUsers = await this.userProfileRepository.findTopUsers(neededCount, excludeIds);
      }

      const graphUserEntities =
         selectedGraphIds.length > 0
            ? await this.userProfileRepository.findByIds(selectedGraphIds, UserStatus.ACTIVE)
            : [];

      const allCandidateEntities = [...graphUserEntities, ...popularUsers];
      if (allCandidateEntities.length === 0) {
         return [];
      }

      const candidateIds = allCandidateEntities.map((u) => u.userId);
      const { followerSet } = await this.followRepository.findFollowRelations(user.userId, candidateIds);

      const mutualCounts = new Map<string, number>();
      await Promise.all(
         allCandidateEntities.map(async (candidate) => {
            if (graphIdSet.has(candidate.userId)) {
               try {
                  const mutuals = await this.graphFollowRepository.getMutualFollowers(user.userId, candidate.userId);
                  mutualCounts.set(candidate.userId, mutuals.length);
               } catch {
                  mutualCounts.set(candidate.userId, 0);
               }
            } else {
               mutualCounts.set(candidate.userId, 0);
            }
         }),
      );

      return allCandidateEntities.map((candidate): UserSuggestionItemDto => {
         const isGraphCandidate = graphIdSet.has(candidate.userId);
         return {
            id: candidate.userId,
            username: candidate.username,
            displayName: candidate.displayName,
            avatar: candidate.avatar,
            bio: candidate.bio,
            isVerified: candidate.settings?.isVerified ?? false,
            followersCount: candidate.stats?.followersCount ?? 0,
            followingCount: candidate.stats?.followingCount ?? 0,
            mutualCount: mutualCounts.get(candidate.userId) ?? 0,
            isFollowing: false,
            isFollower: followerSet.has(candidate.userId),
            reason: isGraphCandidate ? USER_SUGGESTION_REASONS.MUTUAL_FRIENDS : USER_SUGGESTION_REASONS.POPULAR,
         };
      });
   }
}
