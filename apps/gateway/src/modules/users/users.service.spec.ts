import { Test, TestingModule } from '@nestjs/testing';
import { of, throwError } from 'rxjs';
import {
   CircuitBreakerOpenException,
   CircuitBreakerRegistry,
   DEFAULT_ROLES,
   FixedBackoffStrategy,
   GrpcStatus,
   RetryPolicyRegistry,
   ServiceUnavailableException,
} from '@common';
import {
   FOLLOW_STATUS,
   GenderDto,
   USER_ERROR_CODES,
   USER_ERROR_REASONS,
   USER_STATUS,
   USER_V1_GRPC_CLIENT,
   USER_V1_GRPC_SERVICE_NAME,
} from '@contracts/user';

import type { JwtPayload } from '@common';
import { UsersService } from '@/modules/users/users.service';

describe('UsersService', () => {
   let service: UsersService;
   const mockUserGrpcService = {
      checkUsername: jest.fn(),
      getUserById: jest.fn(),
      getMyProfile: jest.fn(),
      getAllUsers: jest.fn(),
      updateUserProfile: jest.fn(),
      updateUsername: jest.fn(),
      getFollowSuggestions: jest.fn(),
      getDateOfBirth: jest.fn(),
      searchUsers: jest.fn(),
      followUser: jest.fn(),
      unfollowUser: jest.fn(),
      getFollowers: jest.fn(),
      getFollowing: jest.fn(),
      getFollowersCount: jest.fn(),
      getFollowingCount: jest.fn(),
      getMutualFollowers: jest.fn(),
      acceptFollowRequest: jest.fn(),
      rejectFollowRequest: jest.fn(),
      getUserByAccountId: jest.fn(),
      getUserByUsername: jest.fn(),
      restoreUser: jest.fn(),
      getUserStats: jest.fn(),
   };
   const mockUserGrpcClient = {
      getService: jest.fn().mockReturnValue(mockUserGrpcService),
   };
   const mockUser: JwtPayload = {
      sub: 'auth-user-1',
      email: 'user@example.com',
      roles: [DEFAULT_ROLES.USER],
      jti: 'session-456',
   };

   beforeEach(async () => {
      CircuitBreakerRegistry.clear();
      RetryPolicyRegistry.clear();
      RetryPolicyRegistry.getOrCreate(USER_V1_GRPC_SERVICE_NAME, {
         maxAttempts: 3,
         backoff: new FixedBackoffStrategy(1),
      });
      jest.clearAllMocks();

      const module: TestingModule = await Test.createTestingModule({
         providers: [
            UsersService,
            {
               provide: USER_V1_GRPC_CLIENT,
               useValue: mockUserGrpcClient,
            },
         ],
      }).compile();

      service = module.get<UsersService>(UsersService);
      service.onModuleInit();
   });

   it('should be defined', () => {
      expect(service).toBeDefined();
   });

   it('should check username availability via gRPC client', async () => {
      mockUserGrpcService.checkUsername.mockReturnValue(of({ available: true, username: 'john_doe' }));

      const result = await service.checkUsername('john_doe');
      expect(mockUserGrpcClient.getService).toHaveBeenCalledWith(USER_V1_GRPC_SERVICE_NAME);
      expect(mockUserGrpcService.checkUsername).toHaveBeenCalledWith({ username: 'john_doe' }, expect.anything());
      expect(result).toEqual({ available: true, username: 'john_doe' });
   });

   it('should transparently retry and succeed on transient gRPC error', async () => {
      let callCount = 0;
      mockUserGrpcService.checkUsername.mockImplementation(() => {
         callCount++;
         if (callCount === 1) {
            return throwError(() => ({ code: GrpcStatus.UNAVAILABLE, message: 'connection refused' }));
         }
         return of({ available: true, username: 'retry_user' });
      });

      const result = await service.checkUsername('retry_user');
      expect(result).toEqual({ available: true, username: 'retry_user' });
      expect(callCount).toBe(2);
   });

   it('should map and handle gRPC errors when checking username', async () => {
      mockUserGrpcService.checkUsername.mockReturnValue(
         throwError(() => ({
            code: GrpcStatus.INVALID_ARGUMENT,
            details: JSON.stringify({
               errorCode: USER_ERROR_CODES.INVALID_USERNAME_FORMAT,
               params: { reason: USER_ERROR_REASONS.EMPTY },
            }),
         })),
      );

      await expect(service.checkUsername('invalid')).rejects.toThrow();
   });

   it('should trip circuit breaker and fail fast when User microservice is unavailable', async () => {
      mockUserGrpcService.checkUsername.mockReturnValue(
         throwError(() => ({ code: GrpcStatus.UNAVAILABLE, message: 'service down' })),
      );

      for (let i = 0; i < 5; i++) {
         try {
            await service.checkUsername('fail_user');
         } catch {
            // expected to throw
         }
      }

      await expect(service.checkUsername('fail_user')).rejects.toThrow(CircuitBreakerOpenException);
      await expect(service.checkUsername('fail_user')).rejects.toThrow(ServiceUnavailableException);
   });

   it('should retrieve user by id via gRPC client with user context', async () => {
      const mockProfile = { id: 'u1', username: 'john', email: 'john@example.com' };
      mockUserGrpcService.getUserById.mockReturnValue(of({ user: mockProfile }));

      const result = await service.getUserById('u1', mockUser);
      expect(mockUserGrpcService.getUserById).toHaveBeenCalledWith({ userId: 'u1' }, expect.anything());
      expect(result).toEqual(mockProfile);
   });

   it('should retrieve all users via gRPC client with user context', async () => {
      const mockUsers = [{ id: 'u1', username: 'john' }];
      mockUserGrpcService.getAllUsers.mockReturnValue(of({ users: mockUsers, total: 1, page: 1, limit: 10 }));

      const result = await service.getAllUsers(1, 10, mockUser);
      expect(mockUserGrpcService.getAllUsers).toHaveBeenCalledWith({ page: 1, limit: 10 }, expect.anything());
      expect(result).toEqual(mockUsers);
   });

   it('should update username via gRPC client with user context', async () => {
      const mockUpdated = { id: 'u1', username: 'new_john' };
      mockUserGrpcService.updateUsername.mockReturnValue(of({ user: mockUpdated }));

      const result = await service.updateUsername('u1', 'new_john', mockUser);
      expect(mockUserGrpcService.updateUsername).toHaveBeenCalledWith(
         { userId: 'u1', username: 'new_john' },
         expect.anything(),
      );
      expect(result).toEqual(mockUpdated);
   });

   it('should update display name via updateDisplayName', async () => {
      const mockUpdated = { id: 'u1', displayName: 'Johnny' };
      mockUserGrpcService.updateUserProfile.mockReturnValue(of({ user: mockUpdated }));

      const result = await service.updateDisplayName('u1', 'Johnny', mockUser);
      expect(mockUserGrpcService.updateUserProfile).toHaveBeenCalledWith(
         expect.objectContaining({ userId: 'u1', displayName: 'Johnny' }),
         expect.anything(),
      );
      expect(result).toEqual(mockUpdated);
   });

   it('should update personal info via updatePersonalInfo', async () => {
      const mockUpdated = { id: 'u1', dateOfBirth: '2000-01-01', gender: 'MALE' };
      mockUserGrpcService.updateUserProfile.mockReturnValue(of({ user: mockUpdated }));

      const result = await service.updatePersonalInfo(
         'u1',
         { dateOfBirth: '2000-01-01', gender: GenderDto.MALE },
         mockUser,
      );
      expect(mockUserGrpcService.updateUserProfile).toHaveBeenCalledWith(
         expect.objectContaining({ userId: 'u1', dateOfBirth: '2000-01-01', gender: 'MALE' }),
         expect.anything(),
      );
      expect(result).toEqual(mockUpdated);
   });

   it('should get date of birth via gRPC client with userId', async () => {
      mockUserGrpcService.getDateOfBirth.mockReturnValue(of({ userId: 'u1', dateOfBirth: '1995-05-15', age: 30 }));

      const result = await service.getDateOfBirth('u1', mockUser);
      expect(mockUserGrpcService.getDateOfBirth).toHaveBeenCalledWith({ userId: 'u1' }, expect.anything());
      expect(result).toEqual({ userId: 'u1', dateOfBirth: '1995-05-15', age: 30 });
   });

   it('should search users via gRPC client with query, limit, cursor, and currentUserId', async () => {
      const mockGrpcRes = {
         items: [
            {
               userId: 'u-1',
               username: 'alex',
               displayName: 'Alex Doe',
               avatar: 'https://example.com/a.jpg',
               bio: 'Bio',
               isVerified: true,
               followersCount: 10,
               followingCount: 5,
               isFollowing: true,
               isFollower: false,
               isSelf: false,
            },
         ],
         nextCursor: 'cursor_next',
         total: 1,
         hasMore: false,
      };
      mockUserGrpcService.searchUsers.mockReturnValue(of(mockGrpcRes));

      const result = await service.searchUsers('alex', 10, 'cursor_val', mockUser);
      expect(mockUserGrpcService.searchUsers).toHaveBeenCalledWith(
         { query: 'alex', limit: 10, cursor: 'cursor_val', currentUserId: mockUser.sub },
         expect.anything(),
      );
      expect(result.items).toHaveLength(1);
      expect(result.items[0].userId).toBe('u-1');
      expect(result.items[0].username).toBe('alex');
      expect(result.meta.nextCursor).toBe('cursor_next');
      expect(result.meta.total).toBe(1);
   });

   it('should get follow suggestions via gRPC client with userId and limit', async () => {
      const mockSuggestions = [
         {
            id: 'u2',
            username: 'alex',
            isVerified: false,
            followersCount: 0,
            followingCount: 0,
            mutualCount: 0,
            isFollowing: false,
            isFollower: false,
            reason: 'popular',
         },
      ];
      mockUserGrpcService.getFollowSuggestions.mockReturnValue(of({ items: mockSuggestions }));

      const result = await service.getFollowSuggestions(10, mockUser);
      expect(mockUserGrpcService.getFollowSuggestions).toHaveBeenCalledWith(
         { userId: mockUser.sub, limit: 10 },
         expect.anything(),
      );
      expect(result).toEqual(mockSuggestions);
   });

   it('should followUser via gRPC client', async () => {
      const mockRes = {
         followId: 'f-1',
         followerId: mockUser.sub,
         followingId: 'target-1',
         status: FOLLOW_STATUS.ACCEPTED,
         createdAt: new Date().toISOString(),
      };
      mockUserGrpcService.followUser.mockReturnValue(of(mockRes));

      const result = await service.followUser(mockUser.sub, 'target-1', mockUser);
      expect(mockUserGrpcService.followUser).toHaveBeenCalledWith(
         { followerId: mockUser.sub, followingId: 'target-1' },
         expect.anything(),
      );
      expect(result).toEqual(mockRes);
   });

   it('should unfollowUser via gRPC client', async () => {
      mockUserGrpcService.unfollowUser.mockReturnValue(of({ success: true }));

      const result = await service.unfollowUser(mockUser.sub, 'target-1', mockUser);
      expect(mockUserGrpcService.unfollowUser).toHaveBeenCalledWith(
         { followerId: mockUser.sub, followingId: 'target-1' },
         expect.anything(),
      );
      expect(result).toEqual({ success: true });
   });

   it('should getUserByAccountId via gRPC client', async () => {
      const mockUserRes = { userId: 'u-1', accountId: 'acc-1', username: 'acc_user' };
      mockUserGrpcService.getUserByAccountId.mockReturnValue(of({ user: mockUserRes }));

      const result = await service.getUserByAccountId('acc-1', mockUser);
      expect(mockUserGrpcService.getUserByAccountId).toHaveBeenCalledWith({ accountId: 'acc-1' }, expect.anything());
      expect(result).toEqual(mockUserRes);
   });

   it('should getUserStats via gRPC client', async () => {
      const mockStats = {
         userId: 'u-1',
         postsCount: 5,
         followersCount: 100,
         followingCount: 50,
         recipesCount: 2,
      };
      mockUserGrpcService.getUserStats.mockReturnValue(of(mockStats));

      const result = await service.getUserStats('u-1', mockUser);
      expect(mockUserGrpcService.getUserStats).toHaveBeenCalledWith({ userId: 'u-1' }, expect.anything());
      expect(result).toEqual(mockStats);
   });

   it('should fallback to degraded snapshot profile when getMyProfile downstream fails', async () => {
      mockUserGrpcService.getMyProfile.mockReturnValue(
         throwError(() => ({ code: GrpcStatus.UNAVAILABLE, message: 'service unavailable' })),
      );

      const result = await service.getMyProfile(mockUser);
      expect(result).toMatchObject({
         userId: mockUser.sub,
         accountId: mockUser.sub,
         username: 'user',
         displayName: 'user',
         status: USER_STATUS.ACTIVE,
      });
   });

   it('should fallback to empty items and meta when searchUsers downstream fails', async () => {
      mockUserGrpcService.searchUsers.mockReturnValue(
         throwError(() => ({ code: GrpcStatus.UNAVAILABLE, message: 'downstream error' })),
      );

      const result = await service.searchUsers('query-123', 10);
      expect(result).toEqual({
         items: [],
         meta: {
            nextCursor: null,
            hasMore: false,
            limit: 10,
            total: 0,
         },
      });
   });

   it('should fallback to empty array when getFollowSuggestions downstream fails', async () => {
      mockUserGrpcService.getFollowSuggestions.mockReturnValue(
         throwError(() => ({ code: GrpcStatus.UNAVAILABLE, message: 'downstream error' })),
      );

      const result = await service.getFollowSuggestions(5, mockUser);
      expect(result).toEqual([]);
   });
});
