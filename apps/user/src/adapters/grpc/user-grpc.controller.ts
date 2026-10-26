import { Controller, Inject, UseFilters, UseInterceptors } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import type { Metadata } from '@grpc/grpc-js';
import { from, type Observable } from 'rxjs';
import {
   checkOwnershipOrAdmin,
   checkRoles,
   CommandBus,
   COMMON_ERROR_CODES,
   DEFAULT_ROLES,
   extractGrpcUser,
   GrpcExceptionFilter,
   GrpcLoggingInterceptor,
   GrpcMetricsInterceptor,
   UnauthorizedException,
} from '@common';
import {
   USER_RESPONSE_MESSAGES,
   USER_SUGGESTION_REASONS,
   USER_V1_GRPC_METHODS,
   USER_V1_GRPC_SERVICE_NAME,
   type ICheckIsFollowingRequest,
   type ICheckIsFollowingResponse,
   type ICheckUsernameRequest,
   type ICheckUsernameResponse,
   type ICreateProfileRequest,
   type IDeleteUserRequest,
   type IFollowUserRequest,
   type IFollowUserResponse,
   type IGetAllUsersRequest,
   type IGetAllUsersResponse,
   type IGetAvatarUploadSignatureRequest,
   type IGetAvatarUploadSignatureResponse,
   type IGetDateOfBirthRequest,
   type IGetDateOfBirthResponse,
   type IGetFollowSuggestionsRequest,
   type IGetFollowSuggestionsResponse,
   type IGetMyProfileRequest,
   type IGetUserByIdRequest,
   type IGetUserResponse,
   type IUnfollowUserRequest,
   type IUnfollowUserResponse,
   type IFollowRequestActionRequest,
   type IFollowRequestActionResponse,
   type IGetFollowCountRequest,
   type IGetFollowCountResponse,
   type IGetFollowersRequest,
   type IGetFollowersResponse,
   type IGetFollowingRequest,
   type IGetFollowingResponse,
   type IGetMutualFollowersRequest,
   type IGetMutualFollowersResponse,
   type IGetUserByAccountIdRequest,
   type IGetUserByUsernameRequest,
   type IGetUserStatsRequest,
   type IRestoreUserRequest,
   type ISearchUsersRequest,
   type ISearchUsersResponse,
   type IUpdateUsernameRequest,
   type IUpdateUserProfileRequest,
   type IUploadAvatarRequest,
   type IUploadAvatarResponse,
   type IUserProto,
   type IUserStatsResponse,
   type IUserSuggestionItemProto,
   type IUserV1GrpcService,
   type UserSearchResponseDto,
   type UserSuggestionItemDto,
} from '@contracts/user';
import type { UploadUrlResponseDto } from '@contracts/media';
import { USER_PROFILE_REPOSITORY, type IUserProfileRepository } from '@user/repositories';
import { CheckUsernameCommand } from '@user/commands/authentication/check-username.command';
import {
   CreateProfileCommand,
   DeleteUserCommand,
   GetAvatarUploadSignatureCommand,
   GetDateOfBirthCommand,
   GetUserByAccountIdCommand,
   GetUserByIdCommand,
   GetUserByUsernameCommand,
   RestoreUserCommand,
   UpdateUsernameCommand,
   UpdateUserProfileCommand,
   UploadAvatarCommand,
} from '@user/commands/profile';
import {
   AcceptFollowRequestCommand,
   CheckIsFollowingCommand,
   FollowUserCommand,
   GetFollowersCommand,
   GetFollowersCountCommand,
   GetFollowingCommand,
   GetFollowingCountCommand,
   GetFollowSuggestionsCommand,
   GetMutualFollowersCommand,
   RejectFollowRequestCommand,
   UnfollowUserCommand,
} from '@user/commands/follow';
import { SearchUsersCommand } from '@user/commands/search';
import { UserCoreService } from '@user/services/domain/user-core.service';
import type { FollowEntity, FollowStatus, Gender, UserEntity } from '@user/entities';

/**
 * Inbound Adapter (Hexagonal Architecture) handling incoming gRPC requests for UserService.
 * Enforces decentralized authorization (Roles, Permissions, Ownership) and delegates to CQRS CommandBus.
 */
@Controller()
@UseFilters(new GrpcExceptionFilter())
@UseInterceptors(GrpcLoggingInterceptor, GrpcMetricsInterceptor)
export class UserGrpcController implements IUserV1GrpcService {
   constructor(
      private readonly commandBus: CommandBus,
      @Inject(USER_PROFILE_REPOSITORY)
      private readonly userProfileRepository: IUserProfileRepository,
      private readonly userCoreService: UserCoreService,
   ) {}

   private mapUserToProto(user: UserEntity): IUserProto {
      return {
         userId: user.userId,
         accountId: user.accountId,
         username: user.username || undefined,
         status: String(user.status),
         createdAt: user.createdAt instanceof Date ? user.createdAt.toISOString() : String(user.createdAt),
         updatedAt: user.updatedAt instanceof Date ? user.updatedAt.toISOString() : String(user.updatedAt),
         lastActiveAt: user.lastActiveAt
            ? user.lastActiveAt instanceof Date
               ? user.lastActiveAt.toISOString()
               : String(user.lastActiveAt)
            : undefined,
         lastUsernameChangedAt: user.lastUsernameChangedAt
            ? user.lastUsernameChangedAt instanceof Date
               ? user.lastUsernameChangedAt.toISOString()
               : String(user.lastUsernameChangedAt)
            : undefined,
         displayName: user.displayName || undefined,
         avatar: user.avatar || undefined,
         bio: user.bio || undefined,
         profile: user.profile
            ? {
                 profileId: user.profile.profileId,
                 userId: user.profile.userId,
                 displayName: user.profile.displayName || undefined,
                 bio: user.profile.bio || undefined,
                 avatar: user.profile.avatar || undefined,
                 coverImage: user.profile.coverImage || undefined,
                 website: user.profile.website || undefined,
                 location: user.profile.location || undefined,
                 createdAt:
                    user.profile.createdAt instanceof Date
                       ? user.profile.createdAt.toISOString()
                       : String(user.profile.createdAt),
                 updatedAt:
                    user.profile.updatedAt instanceof Date
                       ? user.profile.updatedAt.toISOString()
                       : String(user.profile.updatedAt),
              }
            : undefined,
         stats: user.stats
            ? {
                 statsId: user.stats.statsId,
                 userId: user.stats.userId,
                 followersCount: user.stats.followersCount,
                 followingCount: user.stats.followingCount,
                 postsCount: user.stats.postsCount,
                 recipesCount: user.stats.recipesCount,
              }
            : undefined,
         settings: user.settings
            ? {
                 settingsId: user.settings.settingsId,
                 userId: user.settings.userId,
                 isVerified: user.settings.isVerified,
                 isPrivate: user.settings.isPrivate,
              }
            : undefined,
      };
   }

   @GrpcMethod(USER_V1_GRPC_SERVICE_NAME, USER_V1_GRPC_METHODS.CHECK_USERNAME)
   checkUsername(data: ICheckUsernameRequest): Observable<ICheckUsernameResponse> {
      return from(this.commandBus.execute(new CheckUsernameCommand(data.username)));
   }

   @GrpcMethod(USER_V1_GRPC_SERVICE_NAME, USER_V1_GRPC_METHODS.GET_USER_BY_ID)
   getUserById(data: IGetUserByIdRequest, metadata?: Metadata): Observable<IGetUserResponse> {
      const user = extractGrpcUser(metadata);
      return from(
         this.commandBus
            .execute(new GetUserByIdCommand({ data: { userId: data.userId }, user }))
            .then((entity: UserEntity) => ({ user: this.mapUserToProto(entity) })),
      );
   }

   @GrpcMethod(USER_V1_GRPC_SERVICE_NAME, USER_V1_GRPC_METHODS.GET_MY_PROFILE)
   getMyProfile(_data: IGetMyProfileRequest, metadata?: Metadata): Observable<IGetUserResponse> {
      const user = extractGrpcUser(metadata);
      if (!user) {
         throw new UnauthorizedException(COMMON_ERROR_CODES.UNAUTHORIZED);
      }
      return from(
         this.commandBus
            .execute(new GetUserByIdCommand({ data: { userId: user.userId }, user }))
            .then((entity: UserEntity) => ({ user: this.mapUserToProto(entity) })),
      );
   }

   @GrpcMethod(USER_V1_GRPC_SERVICE_NAME, USER_V1_GRPC_METHODS.GET_ALL_USERS)
   getAllUsers(data: IGetAllUsersRequest, metadata?: Metadata): Observable<IGetAllUsersResponse> {
      checkRoles(metadata, [DEFAULT_ROLES.ADMIN]);

      const page = data.page && data.page > 0 ? data.page : 1;
      const limit = data.limit && data.limit > 0 ? data.limit : 10;
      const skip = (page - 1) * limit;

      return from(
         Promise.all([this.userProfileRepository.findAll(skip, limit), this.userProfileRepository.count()]).then(
            ([users, total]) => ({
               users: users.map((u) => this.mapUserToProto(u)),
               total,
               page,
               limit,
            }),
         ),
      );
   }

   @GrpcMethod(USER_V1_GRPC_SERVICE_NAME, USER_V1_GRPC_METHODS.CREATE_PROFILE)
   createProfile(data: ICreateProfileRequest, metadata?: Metadata): Observable<IGetUserResponse> {
      const user = extractGrpcUser(metadata);
      return from(
         this.commandBus
            .execute(
               new CreateProfileCommand({
                  data: {
                     ...data,
                     gender: data.gender ? (data.gender as Gender) : undefined,
                     accountId: data.accountId || user?.userId,
                     userId: data.userId || user?.userId,
                  },
                  user,
               }),
            )
            .then((entity: UserEntity) => ({ user: this.mapUserToProto(entity) })),
      );
   }

   @GrpcMethod(USER_V1_GRPC_SERVICE_NAME, USER_V1_GRPC_METHODS.UPDATE_USER_PROFILE)
   updateUserProfile(data: IUpdateUserProfileRequest, metadata?: Metadata): Observable<IGetUserResponse> {
      checkOwnershipOrAdmin(metadata, data.userId);
      const user = extractGrpcUser(metadata);
      return from(
         this.commandBus
            .execute(
               new UpdateUserProfileCommand({
                  data: {
                     ...data,
                     gender: data.gender ? (data.gender as Gender) : undefined,
                  },
                  user,
               }),
            )
            .then((entity: UserEntity) => ({ user: this.mapUserToProto(entity) })),
      );
   }

   @GrpcMethod(USER_V1_GRPC_SERVICE_NAME, USER_V1_GRPC_METHODS.UPDATE_USERNAME)
   updateUsername(data: IUpdateUsernameRequest, metadata?: Metadata): Observable<IGetUserResponse> {
      checkOwnershipOrAdmin(metadata, data.userId);
      const user = extractGrpcUser(metadata);
      return from(
         this.commandBus
            .execute(new UpdateUsernameCommand({ data, user }))
            .then((entity: UserEntity) => ({ user: this.mapUserToProto(entity) })),
      );
   }

   @GrpcMethod(USER_V1_GRPC_SERVICE_NAME, USER_V1_GRPC_METHODS.DELETE_USER)
   deleteUser(data: IDeleteUserRequest, metadata?: Metadata): Observable<IGetUserResponse> {
      checkOwnershipOrAdmin(metadata, data.userId);
      const user = extractGrpcUser(metadata);
      return from(
         this.commandBus
            .execute(new DeleteUserCommand({ data, user }))
            .then((entity: UserEntity) => ({ user: this.mapUserToProto(entity) })),
      );
   }

   @GrpcMethod(USER_V1_GRPC_SERVICE_NAME, USER_V1_GRPC_METHODS.UPLOAD_AVATAR)
   uploadAvatar(data: IUploadAvatarRequest, metadata?: Metadata): Observable<IUploadAvatarResponse> {
      checkOwnershipOrAdmin(metadata, data.userId);
      const user = extractGrpcUser(metadata);
      return from(
         this.commandBus
            .execute(new UploadAvatarCommand({ data, user }))
            .then((res: { avatarUrl: string; publicId: string; user?: UserEntity }) => ({
               avatarUrl: res.avatarUrl,
               publicId: res.publicId,
               user: res.user ? this.mapUserToProto(res.user) : undefined,
            })),
      );
   }

   @GrpcMethod(USER_V1_GRPC_SERVICE_NAME, USER_V1_GRPC_METHODS.GET_AVATAR_UPLOAD_SIGNATURE)
   getAvatarUploadSignature(
      data: IGetAvatarUploadSignatureRequest,
      metadata?: Metadata,
   ): Observable<IGetAvatarUploadSignatureResponse> {
      checkOwnershipOrAdmin(metadata, data.userId);
      const user = extractGrpcUser(metadata);
      return from(
         this.commandBus
            .execute(new GetAvatarUploadSignatureCommand({ data, user }))
            .then((res: UploadUrlResponseDto): IGetAvatarUploadSignatureResponse => ({
               signature: res.signature,
               timestamp: res.timestamp,
               apiKey: res.apiKey,
               cloudName: res.cloudName,
               uploadUrl: res.uploadUrl,
               publicUrl: res.publicUrl,
               key: res.key,
               mediaId: res.mediaId,
               provider: res.provider,
               method: res.method,
            })),
      );
   }

   @GrpcMethod(USER_V1_GRPC_SERVICE_NAME, USER_V1_GRPC_METHODS.FOLLOW_USER)
   followUser(data: IFollowUserRequest, metadata?: Metadata): Observable<IFollowUserResponse> {
      checkOwnershipOrAdmin(metadata, data.followerId);
      const user = extractGrpcUser(metadata);
      return from(
         this.commandBus.execute(new FollowUserCommand({ data, user })).then((f) => ({
            followId: f.followId,
            followerId: f.followerId,
            followingId: f.followingId,
            status: String(f.status),
            createdAt: f.createdAt instanceof Date ? f.createdAt.toISOString() : String(f.createdAt),
         })),
      );
   }

   @GrpcMethod(USER_V1_GRPC_SERVICE_NAME, USER_V1_GRPC_METHODS.UNFOLLOW_USER)
   unfollowUser(data: IUnfollowUserRequest, metadata?: Metadata): Observable<IUnfollowUserResponse> {
      checkOwnershipOrAdmin(metadata, data.followerId);
      const user = extractGrpcUser(metadata);
      return from(this.commandBus.execute(new UnfollowUserCommand({ data, user })));
   }

   @GrpcMethod(USER_V1_GRPC_SERVICE_NAME, USER_V1_GRPC_METHODS.CHECK_IS_FOLLOWING)
   checkIsFollowing(data: ICheckIsFollowingRequest): Observable<ICheckIsFollowingResponse> {
      return from(this.commandBus.execute(new CheckIsFollowingCommand(data.followerId, data.followingId)));
   }

   @GrpcMethod(USER_V1_GRPC_SERVICE_NAME, USER_V1_GRPC_METHODS.GET_FOLLOW_SUGGESTIONS)
   getFollowSuggestions(
      data: IGetFollowSuggestionsRequest,
      metadata?: Metadata,
   ): Observable<IGetFollowSuggestionsResponse> {
      const user = extractGrpcUser(metadata);
      const targetUserId = data.userId || user?.userId || '';
      return from(
         this.commandBus.execute(new GetFollowSuggestionsCommand(targetUserId, data.limit)).then((items) => ({
            items: (items || []).map((i: UserSuggestionItemDto): IUserSuggestionItemProto => ({
               userId: i.id,
               username: i.username ?? undefined,
               displayName: i.displayName ?? undefined,
               avatar: i.avatar ?? undefined,
               bio: i.bio ?? undefined,
               isVerified: Boolean(i.isVerified),
               followersCount: Number(i.followersCount) || 0,
               followingCount: Number(i.followingCount) || 0,
               mutualCount: Number(i.mutualCount) || 0,
               isFollowing: Boolean(i.isFollowing),
               isFollower: Boolean(i.isFollower),
               reason: i.reason || USER_SUGGESTION_REASONS.POPULAR,
            })),
         })),
      );
   }

   @GrpcMethod(USER_V1_GRPC_SERVICE_NAME, USER_V1_GRPC_METHODS.GET_DATE_OF_BIRTH)
   getDateOfBirth(data: IGetDateOfBirthRequest, metadata?: Metadata): Observable<IGetDateOfBirthResponse> {
      checkOwnershipOrAdmin(metadata, data.userId);

      return from(
         this.commandBus.execute(new GetDateOfBirthCommand(data.userId)).then((res) => ({
            userId: res.userId,
            dateOfBirth: res.dateOfBirth
               ? res.dateOfBirth instanceof Date
                  ? res.dateOfBirth.toISOString()
                  : String(res.dateOfBirth)
               : undefined,
            age: res.age ?? undefined,
         })),
      );
   }

   @GrpcMethod(USER_V1_GRPC_SERVICE_NAME, USER_V1_GRPC_METHODS.SEARCH_USERS)
   searchUsers(data: ISearchUsersRequest, metadata?: Metadata): Observable<ISearchUsersResponse> {
      const user = extractGrpcUser(metadata);
      const currentUserId = data.currentUserId || user?.userId;
      return from(
         this.commandBus
            .execute(new SearchUsersCommand(data.query, data.limit, data.cursor, currentUserId))
            .then((res: UserSearchResponseDto): ISearchUsersResponse => ({
               items: (res.items || []).map((item) => ({
                  userId: item.userId,
                  username: item.username ?? undefined,
                  displayName: item.displayName ?? undefined,
                  avatar: item.avatar ?? undefined,
                  bio: item.bio ?? undefined,
                  isFollowing: Boolean(item.isFollowing),
                  isFollower: Boolean(item.isFollower),
                  isSelf: Boolean(item.isSelf),
                  isVerified: Boolean(item.isVerified),
                  followersCount: item.followersCount || 0,
                  followingCount: item.followingCount || 0,
                  score: 0,
               })),
               nextCursor: res.meta?.nextCursor ?? undefined,
               total: res.meta?.total ?? 0,
               hasMore: Boolean(res.meta?.hasMore),
            })),
      );
   }

   @GrpcMethod(USER_V1_GRPC_SERVICE_NAME, USER_V1_GRPC_METHODS.GET_FOLLOWERS)
   getFollowers(data: IGetFollowersRequest): Observable<IGetFollowersResponse> {
      return from(
         this.commandBus
            .execute(
               new GetFollowersCommand(
                  data.userId,
                  data.status ? (data.status as FollowStatus) : undefined,
                  data.skip,
                  data.take,
               ),
            )
            .then((follows: FollowEntity[]): IGetFollowersResponse => ({
               items: (follows || []).map((f) => ({
                  followId: f.followId,
                  followerId: f.followerId,
                  followingId: f.followingId,
                  status: String(f.status),
                  createdAt: f.createdAt instanceof Date ? f.createdAt.toISOString() : String(f.createdAt),
               })),
               total: (follows || []).length,
            })),
      );
   }

   @GrpcMethod(USER_V1_GRPC_SERVICE_NAME, USER_V1_GRPC_METHODS.GET_FOLLOWING)
   getFollowing(data: IGetFollowingRequest): Observable<IGetFollowingResponse> {
      return from(
         this.commandBus
            .execute(
               new GetFollowingCommand(
                  data.userId,
                  data.status ? (data.status as FollowStatus) : undefined,
                  data.skip,
                  data.take,
               ),
            )
            .then((follows: FollowEntity[]): IGetFollowingResponse => ({
               items: (follows || []).map((f) => ({
                  followId: f.followId,
                  followerId: f.followerId,
                  followingId: f.followingId,
                  status: String(f.status),
                  createdAt: f.createdAt instanceof Date ? f.createdAt.toISOString() : String(f.createdAt),
               })),
               total: (follows || []).length,
            })),
      );
   }

   @GrpcMethod(USER_V1_GRPC_SERVICE_NAME, USER_V1_GRPC_METHODS.GET_FOLLOWERS_COUNT)
   getFollowersCount(data: IGetFollowCountRequest): Observable<IGetFollowCountResponse> {
      return from(
         this.commandBus
            .execute(new GetFollowersCountCommand(data.userId, data.status ? (data.status as FollowStatus) : undefined))
            .then((res: { count: number }) => ({
               userId: data.userId,
               count: res.count,
            })),
      );
   }

   @GrpcMethod(USER_V1_GRPC_SERVICE_NAME, USER_V1_GRPC_METHODS.GET_FOLLOWING_COUNT)
   getFollowingCount(data: IGetFollowCountRequest): Observable<IGetFollowCountResponse> {
      return from(
         this.commandBus
            .execute(new GetFollowingCountCommand(data.userId, data.status ? (data.status as FollowStatus) : undefined))
            .then((res: { count: number }) => ({
               userId: data.userId,
               count: res.count,
            })),
      );
   }

   @GrpcMethod(USER_V1_GRPC_SERVICE_NAME, USER_V1_GRPC_METHODS.GET_MUTUAL_FOLLOWERS)
   getMutualFollowers(data: IGetMutualFollowersRequest): Observable<IGetMutualFollowersResponse> {
      return from(
         this.commandBus
            .execute(new GetMutualFollowersCommand(data.userId1, data.userId2))
            .then((mutualUserIds: string[]) => ({
               mutualUserIds: mutualUserIds || [],
               total: (mutualUserIds || []).length,
            })),
      );
   }

   @GrpcMethod(USER_V1_GRPC_SERVICE_NAME, USER_V1_GRPC_METHODS.ACCEPT_FOLLOW_REQUEST)
   acceptFollowRequest(data: IFollowRequestActionRequest): Observable<IFollowRequestActionResponse> {
      return from(
         this.commandBus.execute(new AcceptFollowRequestCommand(data.followId)).then((f: FollowEntity) => ({
            success: true,
            message: USER_RESPONSE_MESSAGES.ACCEPT_FOLLOW_REQUEST_SUCCESS,
            status: String(f.status),
         })),
      );
   }

   @GrpcMethod(USER_V1_GRPC_SERVICE_NAME, USER_V1_GRPC_METHODS.REJECT_FOLLOW_REQUEST)
   rejectFollowRequest(data: IFollowRequestActionRequest): Observable<IFollowRequestActionResponse> {
      return from(
         this.commandBus.execute(new RejectFollowRequestCommand(data.followId)).then((f: FollowEntity) => ({
            success: true,
            message: USER_RESPONSE_MESSAGES.REJECT_FOLLOW_REQUEST_SUCCESS,
            status: String(f.status),
         })),
      );
   }

   @GrpcMethod(USER_V1_GRPC_SERVICE_NAME, USER_V1_GRPC_METHODS.GET_USER_BY_ACCOUNT_ID)
   getUserByAccountId(data: IGetUserByAccountIdRequest): Observable<IGetUserResponse> {
      return from(
         this.commandBus
            .execute(new GetUserByAccountIdCommand(data.accountId))
            .then((entity: UserEntity) => ({ user: this.mapUserToProto(entity) })),
      );
   }

   @GrpcMethod(USER_V1_GRPC_SERVICE_NAME, USER_V1_GRPC_METHODS.GET_USER_BY_USERNAME)
   getUserByUsername(data: IGetUserByUsernameRequest): Observable<IGetUserResponse> {
      return from(
         this.commandBus
            .execute(new GetUserByUsernameCommand(data.username))
            .then((entity: UserEntity) => ({ user: this.mapUserToProto(entity) })),
      );
   }

   @GrpcMethod(USER_V1_GRPC_SERVICE_NAME, USER_V1_GRPC_METHODS.RESTORE_USER)
   restoreUser(data: IRestoreUserRequest, metadata?: Metadata): Observable<IGetUserResponse> {
      checkOwnershipOrAdmin(metadata, data.userId);
      return from(
         this.commandBus
            .execute(new RestoreUserCommand(data.userId))
            .then((entity: UserEntity) => ({ user: this.mapUserToProto(entity) })),
      );
   }

   @GrpcMethod(USER_V1_GRPC_SERVICE_NAME, USER_V1_GRPC_METHODS.GET_USER_STATS)
   getUserStats(data: IGetUserStatsRequest): Observable<IUserStatsResponse> {
      return from(
         this.userCoreService.getUserStats(data.userId).then((stats) => ({
            userId: data.userId,
            postsCount: stats?.postsCount ?? 0,
            followersCount: stats?.followersCount ?? 0,
            followingCount: stats?.followingCount ?? 0,
            recipesCount: stats?.recipesCount ?? 0,
            likesReceivedCount: 0,
         })),
      );
   }
}
