import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import {
   BulkheadRegistry,
   CircuitBreakerRegistry,
   createGrpcMetadata,
   handleGrpcError,
   RetryPolicyRegistry,
   SERVICE_NAMES,
   withGrpcRetry,
} from '@common';
import {
   HEALTH_GRPC_SERVICE_NAME,
   ServingStatus,
   type IHealthCheckResponse,
   type IHealthGrpcService,
} from '@contracts/health';
import {
   CreateUserProfileDto,
   UserDateOfBirthResponseDto,
   UserSearchResponseDto,
   UpdatePersonalInfoDto,
   USER_STATUS,
   USER_V1_GRPC_CLIENT,
   USER_V1_GRPC_SERVICE_NAME,
   type IFollowRequestActionResponse,
   type IFollowUserResponse,
   type IGetFollowCountResponse,
   type IGetFollowersResponse,
   type IGetFollowingResponse,
   type IGetMutualFollowersResponse,
   type IUserStatsResponse,
   type IUnfollowUserResponse,
   type IUserProto,
   type IUserV1GrpcService,
} from '@contracts/user';
import { defer, firstValueFrom } from 'rxjs';
import type { JwtPayload } from '@common/utils/jwt.util';

@Injectable()
export class UsersService implements OnModuleInit {
   private readonly logger = new Logger(UsersService.name);
   private userGrpcService!: IUserV1GrpcService;
   private readonly userBulkhead = BulkheadRegistry.getOrCreate(USER_V1_GRPC_SERVICE_NAME, {
      maxConcurrent: 50,
      maxQueueCapacity: 100,
   });
   private readonly userGrpcBreaker = CircuitBreakerRegistry.getOrCreate(USER_V1_GRPC_SERVICE_NAME, {
      timeout: 3000,
      failureThreshold: 5,
      resetTimeout: 10000,
   });
   private readonly userGrpcRetryPolicy = RetryPolicyRegistry.getOrCreate(USER_V1_GRPC_SERVICE_NAME, {
      maxAttempts: 3,
      initialDelayMs: 100,
      multiplier: 2,
      maxDelayMs: 2000,
   });

   constructor(@Inject(USER_V1_GRPC_CLIENT) private readonly userGrpcClient: ClientGrpc) {}

   onModuleInit(): void {
      this.userGrpcService = this.userGrpcClient.getService<IUserV1GrpcService>(USER_V1_GRPC_SERVICE_NAME);
   }

   private buildGrpcMetadata(user?: JwtPayload, correlationId?: string) {
      return createGrpcMetadata({
         correlationId,
         callerService: SERVICE_NAMES.GATEWAY,
         user: user
            ? {
                 userId: user.sub,
                 accountId: user.sub,
                 roles: user.roles || [],
                 email: user.email,
                 permissions: (user.permissions as string[]) || [],
                 sessionId: user.jti,
              }
            : undefined,
      });
   }

   async checkUsername(username: string, correlationId?: string): Promise<{ available: boolean; username: string }> {
      try {
         const metadata = this.buildGrpcMetadata(undefined, correlationId);
         return await this.userGrpcBreaker.execute(async () => {
            return await firstValueFrom(
               defer(() => this.userGrpcService.checkUsername({ username }, metadata)).pipe(
                  withGrpcRetry(this.userGrpcRetryPolicy),
               ),
            );
         });
      } catch (error: unknown) {
         return handleGrpcError(error);
      }
   }

   async checkGrpcHealth(): Promise<IHealthCheckResponse> {
      try {
         const healthService = this.userGrpcClient.getService<IHealthGrpcService>(HEALTH_GRPC_SERVICE_NAME);
         return await firstValueFrom(healthService.check({ service: USER_V1_GRPC_SERVICE_NAME }));
      } catch {
         return { status: ServingStatus.NOT_SERVING };
      }
   }

   async createProfile(
      createUserProfileDto: CreateUserProfileDto,
      user: JwtPayload,
      correlationId?: string,
   ): Promise<unknown> {
      try {
         const metadata = this.buildGrpcMetadata(user, correlationId);
         return await this.userGrpcBreaker.execute(async () => {
            const res = await firstValueFrom(
               defer(() =>
                  this.userGrpcService.createProfile(
                     {
                        username: createUserProfileDto.username,
                        displayName: createUserProfileDto.displayName,
                        gender: createUserProfileDto.gender,
                        dateOfBirth: createUserProfileDto.dateOfBirth
                           ? String(createUserProfileDto.dateOfBirth)
                           : undefined,
                        bio: createUserProfileDto.bio,
                        avatar: createUserProfileDto.avatar,
                        coverImage: createUserProfileDto.coverImage,
                        website: createUserProfileDto.website,
                        location: createUserProfileDto.location,
                        accountId: user.sub,
                        userId: user.sub,
                     },
                     metadata,
                  ),
               ).pipe(withGrpcRetry(this.userGrpcRetryPolicy)),
            );
            return res.user;
         });
      } catch (error: unknown) {
         return handleGrpcError(error);
      }
   }

   async getUserById(id: string, user?: JwtPayload, correlationId?: string): Promise<unknown> {
      try {
         const metadata = this.buildGrpcMetadata(user, correlationId);
         return await this.userGrpcBreaker.execute(async () => {
            const res = await firstValueFrom(
               defer(() => this.userGrpcService.getUserById({ userId: id }, metadata)).pipe(
                  withGrpcRetry(this.userGrpcRetryPolicy),
               ),
            );
            return res.user;
         });
      } catch (error: unknown) {
         return handleGrpcError(error);
      }
   }

   async getAllUsers(page = 1, limit = 10, user?: JwtPayload, correlationId?: string): Promise<unknown> {
      try {
         const metadata = this.buildGrpcMetadata(user, correlationId);
         return await this.userGrpcBreaker.execute(async () => {
            const res = await firstValueFrom(
               defer(() => this.userGrpcService.getAllUsers({ page, limit }, metadata)).pipe(
                  withGrpcRetry(this.userGrpcRetryPolicy),
               ),
            );
            return res.users;
         });
      } catch (error: unknown) {
         return handleGrpcError(error);
      }
   }

   async updateUsername(userId: string, username: string, user: JwtPayload, correlationId?: string): Promise<unknown> {
      try {
         const metadata = this.buildGrpcMetadata(user, correlationId);
         return await this.userGrpcBreaker.execute(async () => {
            const res = await firstValueFrom(
               defer(() => this.userGrpcService.updateUsername({ userId, username }, metadata)).pipe(
                  withGrpcRetry(this.userGrpcRetryPolicy),
               ),
            );
            return res.user;
         });
      } catch (error: unknown) {
         return handleGrpcError(error);
      }
   }

   async updateDisplayName(
      userId: string,
      displayName: string,
      user: JwtPayload,
      correlationId?: string,
   ): Promise<unknown> {
      return this.updatePartialProfile(userId, { displayName }, user, correlationId);
   }

   async updateBio(
      userId: string,
      bio: string | undefined,
      user: JwtPayload,
      correlationId?: string,
   ): Promise<unknown> {
      return this.updatePartialProfile(userId, { bio }, user, correlationId);
   }

   async updatePersonalInfo(
      userId: string,
      dto: UpdatePersonalInfoDto,
      user: JwtPayload,
      correlationId?: string,
   ): Promise<unknown> {
      return this.updatePartialProfile(
         userId,
         { dateOfBirth: dto.dateOfBirth, gender: dto.gender },
         user,
         correlationId,
      );
   }

   async updateLocation(
      userId: string,
      location: string | undefined,
      user: JwtPayload,
      correlationId?: string,
   ): Promise<unknown> {
      return this.updatePartialProfile(userId, { location }, user, correlationId);
   }

   async updateWebsite(
      userId: string,
      website: string | undefined,
      user: JwtPayload,
      correlationId?: string,
   ): Promise<unknown> {
      return this.updatePartialProfile(userId, { website }, user, correlationId);
   }

   async updateCoverImage(
      userId: string,
      coverImage: string,
      user: JwtPayload,
      correlationId?: string,
   ): Promise<unknown> {
      return this.updatePartialProfile(userId, { coverImage }, user, correlationId);
   }

   private async updatePartialProfile(
      userId: string,
      fields: Record<string, unknown>,
      user: JwtPayload,
      correlationId?: string,
   ): Promise<unknown> {
      try {
         const metadata = this.buildGrpcMetadata(user, correlationId);
         return await this.userGrpcBreaker.execute(async () => {
            const res = await firstValueFrom(
               defer(() =>
                  this.userGrpcService.updateUserProfile(
                     {
                        userId,
                        displayName: typeof fields.displayName === 'string' ? fields.displayName : undefined,
                        bio: typeof fields.bio === 'string' ? fields.bio : undefined,
                        dateOfBirth:
                           fields.dateOfBirth instanceof Date
                              ? fields.dateOfBirth.toISOString()
                              : typeof fields.dateOfBirth === 'string'
                                ? fields.dateOfBirth
                                : undefined,
                        gender: typeof fields.gender === 'string' ? fields.gender : undefined,
                        location: typeof fields.location === 'string' ? fields.location : undefined,
                        website: typeof fields.website === 'string' ? fields.website : undefined,
                        coverImage: typeof fields.coverImage === 'string' ? fields.coverImage : undefined,
                     },
                     metadata,
                  ),
               ).pipe(withGrpcRetry(this.userGrpcRetryPolicy)),
            );
            return res.user;
         });
      } catch (error: unknown) {
         return handleGrpcError(error);
      }
   }

   private buildFallbackUserProfile(user: JwtPayload): IUserProto {
      const userId = user.sub;
      const accountId = user.sub;
      const username = user.email ? user.email.split('@')[0] : 'user';
      const now = new Date().toISOString();
      return {
         userId,
         accountId,
         username,
         displayName: username,
         status: USER_STATUS.ACTIVE,
         createdAt: now,
         updatedAt: now,
      };
   }

   async getMyProfile(user: JwtPayload, correlationId?: string): Promise<IUserProto | undefined> {
      try {
         const metadata = this.buildGrpcMetadata(user, correlationId);
         return await this.userBulkhead.execute(
            () =>
               this.userGrpcBreaker.execute(
                  async () => {
                     const res = await firstValueFrom(
                        defer(() => this.userGrpcService.getMyProfile({ userId: user.sub }, metadata)).pipe(
                           withGrpcRetry(this.userGrpcRetryPolicy),
                        ),
                     );
                     return res.user;
                  },
                  (err) => {
                     this.logger.warn(`getMyProfile degraded snapshot fallback: ${err.message}`);
                     return this.buildFallbackUserProfile(user);
                  },
               ),
            (err) => {
               this.logger.warn(`getMyProfile bulkhead snapshot fallback: ${err.message}`);
               return this.buildFallbackUserProfile(user);
            },
         );
      } catch (error: unknown) {
         return handleGrpcError(error);
      }
   }

   async searchUsers(
      query: string,
      limit = 10,
      cursor?: string,
      user?: JwtPayload,
      correlationId?: string,
   ): Promise<UserSearchResponseDto> {
      try {
         const metadata = this.buildGrpcMetadata(user, correlationId);
         return await this.userBulkhead.execute(
            () =>
               this.userGrpcBreaker.execute(
                  async () => {
                     const res = await firstValueFrom(
                        defer(() =>
                           this.userGrpcService.searchUsers(
                              {
                                 query,
                                 limit,
                                 cursor,
                                 currentUserId: user?.sub,
                              },
                              metadata,
                           ),
                        ).pipe(withGrpcRetry(this.userGrpcRetryPolicy)),
                     );
                     return {
                        items: (res.items || []).map((item) => ({
                           userId: item.userId,
                           username: item.username ?? null,
                           displayName: item.displayName ?? null,
                           avatar: item.avatar ?? null,
                           bio: item.bio ?? null,
                           isVerified: Boolean(item.isVerified),
                           followersCount: item.followersCount || 0,
                           followingCount: item.followingCount || 0,
                           isFollowing: Boolean(item.isFollowing),
                           isFollower: Boolean(item.isFollower),
                           isSelf: Boolean(item.isSelf),
                        })),
                        meta: {
                           nextCursor: res.nextCursor ?? null,
                           hasMore: Boolean(res.hasMore),
                           limit,
                           total: res.total,
                        },
                     };
                  },
                  (err) => {
                     this.logger.warn(`searchUsers fallback triggered for "${query}": ${err.message}`);
                     return {
                        items: [],
                        meta: {
                           nextCursor: null,
                           hasMore: false,
                           limit,
                           total: 0,
                        },
                     };
                  },
               ),
            (err) => {
               this.logger.warn(`searchUsers bulkhead fallback for "${query}": ${err.message}`);
               return {
                  items: [],
                  meta: {
                     nextCursor: null,
                     hasMore: false,
                     limit,
                     total: 0,
                  },
               };
            },
         );
      } catch (error: unknown) {
         return handleGrpcError(error);
      }
   }

   async getFollowSuggestions(limit = 10, user: JwtPayload, correlationId?: string): Promise<unknown> {
      try {
         const metadata = this.buildGrpcMetadata(user, correlationId);
         return await this.userBulkhead.execute(
            () =>
               this.userGrpcBreaker.execute(
                  async () => {
                     const res = await firstValueFrom(
                        defer(() =>
                           this.userGrpcService.getFollowSuggestions({ userId: user.sub, limit }, metadata),
                        ).pipe(withGrpcRetry(this.userGrpcRetryPolicy)),
                     );
                     return res.items;
                  },
                  (err) => {
                     this.logger.warn(`getFollowSuggestions fallback triggered: ${err.message}`);
                     return [];
                  },
               ),
            (err) => {
               this.logger.warn(`getFollowSuggestions bulkhead fallback triggered: ${err.message}`);
               return [];
            },
         );
      } catch (error: unknown) {
         return handleGrpcError(error);
      }
   }

   async uploadAvatar(
      id: string,
      fileBase64: string,
      mimeType?: string,
      user?: JwtPayload,
      correlationId?: string,
   ): Promise<unknown> {
      try {
         const metadata = this.buildGrpcMetadata(user, correlationId);
         return await this.userGrpcBreaker.execute(async () => {
            return await firstValueFrom(
               defer(() =>
                  this.userGrpcService.uploadAvatar(
                     {
                        userId: id,
                        fileBase64,
                        mimeType,
                     },
                     metadata,
                  ),
               ).pipe(withGrpcRetry(this.userGrpcRetryPolicy)),
            );
         });
      } catch (error: unknown) {
         return handleGrpcError(error);
      }
   }

   async getAvatarUploadSignature(id: string, user?: JwtPayload, correlationId?: string): Promise<unknown> {
      try {
         const metadata = this.buildGrpcMetadata(user, correlationId);
         return await this.userGrpcBreaker.execute(async () => {
            return await firstValueFrom(
               defer(() => this.userGrpcService.getAvatarUploadSignature({ userId: id }, metadata)).pipe(
                  withGrpcRetry(this.userGrpcRetryPolicy),
               ),
            );
         });
      } catch (error: unknown) {
         return handleGrpcError(error);
      }
   }

   async getDateOfBirth(
      userId: string,
      user?: JwtPayload,
      correlationId?: string,
   ): Promise<UserDateOfBirthResponseDto> {
      try {
         const metadata = this.buildGrpcMetadata(user, correlationId);
         return await this.userGrpcBreaker.execute(async () => {
            const res = await firstValueFrom(
               defer(() => this.userGrpcService.getDateOfBirth({ userId }, metadata)).pipe(
                  withGrpcRetry(this.userGrpcRetryPolicy),
               ),
            );
            return {
               userId: res.userId,
               dateOfBirth: res.dateOfBirth || null,
               age: res.age ?? null,
            };
         });
      } catch (error: unknown) {
         return handleGrpcError(error);
      }
   }

   async followUser(
      followerId: string,
      followingId: string,
      user?: JwtPayload,
      correlationId?: string,
   ): Promise<IFollowUserResponse> {
      try {
         const metadata = this.buildGrpcMetadata(user, correlationId);
         return await this.userGrpcBreaker.execute(async () => {
            return await firstValueFrom(
               defer(() => this.userGrpcService.followUser({ followerId, followingId }, metadata)).pipe(
                  withGrpcRetry(this.userGrpcRetryPolicy),
               ),
            );
         });
      } catch (error: unknown) {
         return handleGrpcError(error);
      }
   }

   async unfollowUser(
      followerId: string,
      followingId: string,
      user?: JwtPayload,
      correlationId?: string,
   ): Promise<IUnfollowUserResponse> {
      try {
         const metadata = this.buildGrpcMetadata(user, correlationId);
         return await this.userGrpcBreaker.execute(async () => {
            return await firstValueFrom(
               defer(() => this.userGrpcService.unfollowUser({ followerId, followingId }, metadata)).pipe(
                  withGrpcRetry(this.userGrpcRetryPolicy),
               ),
            );
         });
      } catch (error: unknown) {
         return handleGrpcError(error);
      }
   }

   async getFollowers(
      userId: string,
      status?: string,
      skip?: number,
      take?: number,
      user?: JwtPayload,
      correlationId?: string,
   ): Promise<IGetFollowersResponse> {
      try {
         const metadata = this.buildGrpcMetadata(user, correlationId);
         return await this.userGrpcBreaker.execute(async () => {
            return await firstValueFrom(
               defer(() => this.userGrpcService.getFollowers({ userId, status, skip, take }, metadata)).pipe(
                  withGrpcRetry(this.userGrpcRetryPolicy),
               ),
            );
         });
      } catch (error: unknown) {
         return handleGrpcError(error);
      }
   }

   async getFollowing(
      userId: string,
      status?: string,
      skip?: number,
      take?: number,
      user?: JwtPayload,
      correlationId?: string,
   ): Promise<IGetFollowingResponse> {
      try {
         const metadata = this.buildGrpcMetadata(user, correlationId);
         return await this.userGrpcBreaker.execute(async () => {
            return await firstValueFrom(
               defer(() => this.userGrpcService.getFollowing({ userId, status, skip, take }, metadata)).pipe(
                  withGrpcRetry(this.userGrpcRetryPolicy),
               ),
            );
         });
      } catch (error: unknown) {
         return handleGrpcError(error);
      }
   }

   async getFollowersCount(
      userId: string,
      status?: string,
      user?: JwtPayload,
      correlationId?: string,
   ): Promise<IGetFollowCountResponse> {
      try {
         const metadata = this.buildGrpcMetadata(user, correlationId);
         return await this.userGrpcBreaker.execute(async () => {
            return await firstValueFrom(
               defer(() => this.userGrpcService.getFollowersCount({ userId, status }, metadata)).pipe(
                  withGrpcRetry(this.userGrpcRetryPolicy),
               ),
            );
         });
      } catch (error: unknown) {
         return handleGrpcError(error);
      }
   }

   async getFollowingCount(
      userId: string,
      status?: string,
      user?: JwtPayload,
      correlationId?: string,
   ): Promise<IGetFollowCountResponse> {
      try {
         const metadata = this.buildGrpcMetadata(user, correlationId);
         return await this.userGrpcBreaker.execute(async () => {
            return await firstValueFrom(
               defer(() => this.userGrpcService.getFollowingCount({ userId, status }, metadata)).pipe(
                  withGrpcRetry(this.userGrpcRetryPolicy),
               ),
            );
         });
      } catch (error: unknown) {
         return handleGrpcError(error);
      }
   }

   async getMutualFollowers(
      userId1: string,
      userId2: string,
      user?: JwtPayload,
      correlationId?: string,
   ): Promise<IGetMutualFollowersResponse> {
      try {
         const metadata = this.buildGrpcMetadata(user, correlationId);
         return await this.userGrpcBreaker.execute(async () => {
            return await firstValueFrom(
               defer(() => this.userGrpcService.getMutualFollowers({ userId1, userId2 }, metadata)).pipe(
                  withGrpcRetry(this.userGrpcRetryPolicy),
               ),
            );
         });
      } catch (error: unknown) {
         return handleGrpcError(error);
      }
   }

   async acceptFollowRequest(
      followId: string,
      user?: JwtPayload,
      correlationId?: string,
   ): Promise<IFollowRequestActionResponse> {
      try {
         const metadata = this.buildGrpcMetadata(user, correlationId);
         return await this.userGrpcBreaker.execute(async () => {
            return await firstValueFrom(
               defer(() => this.userGrpcService.acceptFollowRequest({ followId }, metadata)).pipe(
                  withGrpcRetry(this.userGrpcRetryPolicy),
               ),
            );
         });
      } catch (error: unknown) {
         return handleGrpcError(error);
      }
   }

   async rejectFollowRequest(
      followId: string,
      user?: JwtPayload,
      correlationId?: string,
   ): Promise<IFollowRequestActionResponse> {
      try {
         const metadata = this.buildGrpcMetadata(user, correlationId);
         return await this.userGrpcBreaker.execute(async () => {
            return await firstValueFrom(
               defer(() => this.userGrpcService.rejectFollowRequest({ followId }, metadata)).pipe(
                  withGrpcRetry(this.userGrpcRetryPolicy),
               ),
            );
         });
      } catch (error: unknown) {
         return handleGrpcError(error);
      }
   }

   async getUserByAccountId(accountId: string, user?: JwtPayload, correlationId?: string): Promise<unknown> {
      try {
         const metadata = this.buildGrpcMetadata(user, correlationId);
         return await this.userGrpcBreaker.execute(async () => {
            const res = await firstValueFrom(
               defer(() => this.userGrpcService.getUserByAccountId({ accountId }, metadata)).pipe(
                  withGrpcRetry(this.userGrpcRetryPolicy),
               ),
            );
            return res.user;
         });
      } catch (error: unknown) {
         return handleGrpcError(error);
      }
   }

   async getUserByUsername(username: string, user?: JwtPayload, correlationId?: string): Promise<unknown> {
      try {
         const metadata = this.buildGrpcMetadata(user, correlationId);
         return await this.userGrpcBreaker.execute(async () => {
            const res = await firstValueFrom(
               defer(() => this.userGrpcService.getUserByUsername({ username }, metadata)).pipe(
                  withGrpcRetry(this.userGrpcRetryPolicy),
               ),
            );
            return res.user;
         });
      } catch (error: unknown) {
         return handleGrpcError(error);
      }
   }

   async restoreUser(userId: string, user?: JwtPayload, correlationId?: string): Promise<unknown> {
      try {
         const metadata = this.buildGrpcMetadata(user, correlationId);
         return await this.userGrpcBreaker.execute(async () => {
            const res = await firstValueFrom(
               defer(() => this.userGrpcService.restoreUser({ userId }, metadata)).pipe(
                  withGrpcRetry(this.userGrpcRetryPolicy),
               ),
            );
            return res.user;
         });
      } catch (error: unknown) {
         return handleGrpcError(error);
      }
   }

   async getUserStats(userId: string, user?: JwtPayload, correlationId?: string): Promise<IUserStatsResponse> {
      try {
         const metadata = this.buildGrpcMetadata(user, correlationId);
         return await this.userGrpcBreaker.execute(async () => {
            return await firstValueFrom(
               defer(() => this.userGrpcService.getUserStats({ userId }, metadata)).pipe(
                  withGrpcRetry(this.userGrpcRetryPolicy),
               ),
            );
         });
      } catch (error: unknown) {
         return handleGrpcError(error);
      }
   }
}
