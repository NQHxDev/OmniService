import type { Observable } from 'rxjs';
import type { Metadata } from '@grpc/grpc-js';

export interface IUserProfileProto {
   profileId: string;
   userId: string;
   displayName?: string;
   bio?: string;
   avatar?: string;
   coverImage?: string;
   website?: string;
   location?: string;
   createdAt: string;
   updatedAt: string;
}

export interface IUserStatsProto {
   statsId: string;
   userId: string;
   followersCount: number;
   followingCount: number;
   postsCount: number;
   recipesCount: number;
}

export interface IUserSettingsProto {
   settingsId: string;
   userId: string;
   isVerified: boolean;
   isPrivate: boolean;
}

export interface IUserProto {
   userId: string;
   accountId: string;
   username?: string;
   status: string;
   createdAt: string;
   updatedAt: string;
   lastActiveAt?: string;
   lastUsernameChangedAt?: string;
   profile?: IUserProfileProto;
   stats?: IUserStatsProto;
   settings?: IUserSettingsProto;
   displayName?: string;
   avatar?: string;
   bio?: string;
}

export interface IUserSuggestionItemProto {
   userId: string;
   username?: string;
   displayName?: string;
   avatar?: string;
   bio?: string;
   isVerified: boolean;
   followersCount: number;
   followingCount: number;
   mutualCount: number;
   isFollowing: boolean;
   isFollower: boolean;
   reason: string;
}

export interface ICheckUsernameRequest {
   username: string;
}

export interface ICheckUsernameResponse {
   available: boolean;
   username: string;
}

export interface IGetUserByIdRequest {
   userId: string;
}

export interface IGetMyProfileRequest {
   userId?: string;
}

export interface IGetUserResponse {
   user?: IUserProto;
}

export interface IGetAllUsersRequest {
   page?: number;
   limit?: number;
}

export interface IGetAllUsersResponse {
   users: IUserProto[];
   total: number;
   page: number;
   limit: number;
}

export interface ICreateProfileRequest {
   username?: string;
   displayName?: string;
   gender?: string;
   dateOfBirth?: string;
   bio?: string;
   avatar?: string;
   coverImage?: string;
   website?: string;
   location?: string;
   accountId?: string;
   userId?: string;
}

export interface IUpdateUserProfileRequest {
   userId: string;
   displayName?: string;
   bio?: string;
   dateOfBirth?: string;
   gender?: string;
   location?: string;
   website?: string;
   coverImage?: string;
}

export interface IUpdateUsernameRequest {
   userId: string;
   username: string;
}

export interface IDeleteUserRequest {
   userId: string;
}

export interface IUploadAvatarRequest {
   userId: string;
   fileBase64: string;
   mimeType?: string;
}

export interface IUploadAvatarResponse {
   avatarUrl: string;
   publicId: string;
   user?: IUserProto;
}

export interface IGetAvatarUploadSignatureRequest {
   userId: string;
}

export interface IGetAvatarUploadSignatureResponse {
   signature?: string;
   timestamp?: number;
   apiKey?: string;
   cloudName?: string;
   uploadUrl?: string;
   publicUrl?: string;
   key?: string;
   mediaId?: string;
   provider?: string;
   method?: string;
}

export interface IFollowUserRequest {
   followerId: string;
   followingId: string;
}

export interface IFollowUserResponse {
   followId: string;
   followerId: string;
   followingId: string;
   status: string;
   createdAt: string;
}

export interface IUnfollowUserRequest {
   followerId: string;
   followingId: string;
}

export interface IUnfollowUserResponse {
   success: boolean;
}

export interface ICheckIsFollowingRequest {
   followerId: string;
   followingId: string;
}

export interface ICheckIsFollowingResponse {
   isFollowing: boolean;
   status?: string;
}

export interface IGetFollowSuggestionsRequest {
   userId?: string;
   limit?: number;
}

export interface IGetFollowSuggestionsResponse {
   items: IUserSuggestionItemProto[];
}

export interface IGetDateOfBirthRequest {
   userId: string;
}

export interface IGetDateOfBirthResponse {
   userId: string;
   dateOfBirth?: string;
   age?: number;
}

// --- Search Users ---
export interface IUserSearchHitProto {
   userId: string;
   username?: string;
   displayName?: string;
   avatar?: string;
   bio?: string;
   isFollowing: boolean;
   isFollower: boolean;
   isSelf: boolean;
   isVerified: boolean;
   followersCount: number;
   followingCount: number;
   score?: number;
}

export interface ISearchUsersRequest {
   query: string;
   limit?: number;
   cursor?: string;
   currentUserId?: string;
}

export interface ISearchUsersResponse {
   items: IUserSearchHitProto[];
   nextCursor?: string;
   total: number;
   hasMore: boolean;
}

// --- Social Graph & Follow ---
export interface IFollowerItemProto {
   followId: string;
   followerId: string;
   followingId: string;
   status: string;
   createdAt: string;
   user?: IUserProto;
}

export interface IGetFollowersRequest {
   userId: string;
   status?: string;
   skip?: number;
   take?: number;
}

export interface IGetFollowersResponse {
   items: IFollowerItemProto[];
   total: number;
}

export interface IGetFollowingRequest {
   userId: string;
   status?: string;
   skip?: number;
   take?: number;
}

export interface IGetFollowingResponse {
   items: IFollowerItemProto[];
   total: number;
}

export interface IGetFollowCountRequest {
   userId: string;
   status?: string;
}

export interface IGetFollowCountResponse {
   userId: string;
   count: number;
}

export interface IGetMutualFollowersRequest {
   userId1: string;
   userId2: string;
}

export interface IGetMutualFollowersResponse {
   mutualUserIds: string[];
   total: number;
}

export interface IFollowRequestActionRequest {
   followId: string;
}

export interface IFollowRequestActionResponse {
   success: boolean;
   message: string;
   status?: string;
}

// --- Internal Lookups & Lifecycle ---
export interface IGetUserByAccountIdRequest {
   accountId: string;
}

export interface IGetUserByUsernameRequest {
   username: string;
}

export interface IRestoreUserRequest {
   userId: string;
}

// --- User Stats ---
export interface IGetUserStatsRequest {
   userId: string;
}

export interface IUserStatsResponse {
   userId: string;
   postsCount: number;
   followersCount: number;
   followingCount: number;
   recipesCount: number;
   likesReceivedCount?: number;
}

export interface IUserV1GrpcService {
   checkUsername(request: ICheckUsernameRequest, metadata?: Metadata): Observable<ICheckUsernameResponse>;
   getUserById(request: IGetUserByIdRequest, metadata?: Metadata): Observable<IGetUserResponse>;
   getMyProfile(request: IGetMyProfileRequest, metadata?: Metadata): Observable<IGetUserResponse>;
   getAllUsers(request: IGetAllUsersRequest, metadata?: Metadata): Observable<IGetAllUsersResponse>;
   createProfile(request: ICreateProfileRequest, metadata?: Metadata): Observable<IGetUserResponse>;
   updateUserProfile(request: IUpdateUserProfileRequest, metadata?: Metadata): Observable<IGetUserResponse>;
   updateUsername(request: IUpdateUsernameRequest, metadata?: Metadata): Observable<IGetUserResponse>;
   deleteUser(request: IDeleteUserRequest, metadata?: Metadata): Observable<IGetUserResponse>;
   uploadAvatar(request: IUploadAvatarRequest, metadata?: Metadata): Observable<IUploadAvatarResponse>;
   getAvatarUploadSignature(
      request: IGetAvatarUploadSignatureRequest,
      metadata?: Metadata,
   ): Observable<IGetAvatarUploadSignatureResponse>;
   followUser(request: IFollowUserRequest, metadata?: Metadata): Observable<IFollowUserResponse>;
   unfollowUser(request: IUnfollowUserRequest, metadata?: Metadata): Observable<IUnfollowUserResponse>;
   checkIsFollowing(request: ICheckIsFollowingRequest, metadata?: Metadata): Observable<ICheckIsFollowingResponse>;
   getFollowSuggestions(
      request: IGetFollowSuggestionsRequest,
      metadata?: Metadata,
   ): Observable<IGetFollowSuggestionsResponse>;
   getDateOfBirth(request: IGetDateOfBirthRequest, metadata?: Metadata): Observable<IGetDateOfBirthResponse>;
   searchUsers(request: ISearchUsersRequest, metadata?: Metadata): Observable<ISearchUsersResponse>;
   getFollowers(request: IGetFollowersRequest, metadata?: Metadata): Observable<IGetFollowersResponse>;
   getFollowing(request: IGetFollowingRequest, metadata?: Metadata): Observable<IGetFollowingResponse>;
   getFollowersCount(request: IGetFollowCountRequest, metadata?: Metadata): Observable<IGetFollowCountResponse>;
   getFollowingCount(request: IGetFollowCountRequest, metadata?: Metadata): Observable<IGetFollowCountResponse>;
   getMutualFollowers(
      request: IGetMutualFollowersRequest,
      metadata?: Metadata,
   ): Observable<IGetMutualFollowersResponse>;
   acceptFollowRequest(
      request: IFollowRequestActionRequest,
      metadata?: Metadata,
   ): Observable<IFollowRequestActionResponse>;
   rejectFollowRequest(
      request: IFollowRequestActionRequest,
      metadata?: Metadata,
   ): Observable<IFollowRequestActionResponse>;
   getUserByAccountId(request: IGetUserByAccountIdRequest, metadata?: Metadata): Observable<IGetUserResponse>;
   getUserByUsername(request: IGetUserByUsernameRequest, metadata?: Metadata): Observable<IGetUserResponse>;
   restoreUser(request: IRestoreUserRequest, metadata?: Metadata): Observable<IGetUserResponse>;
   getUserStats(request: IGetUserStatsRequest, metadata?: Metadata): Observable<IUserStatsResponse>;
}

// Aliases for compatibility
export type IUserGrpcService = IUserV1GrpcService;
export type ICheckUsernameRequestV1 = ICheckUsernameRequest;
export type ICheckUsernameResponseV1 = ICheckUsernameResponse;
