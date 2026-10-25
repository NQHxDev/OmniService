import { Test, TestingModule } from '@nestjs/testing';
import { firstValueFrom } from 'rxjs';
import { CommandBus, createGrpcMetadata, DEFAULT_ROLES, GrpcLoggingInterceptor, GrpcMetricsInterceptor } from '@common';
import { UserGrpcController } from '@user/adapters/grpc/user-grpc.controller';
import { CheckUsernameCommand } from '@user/commands/authentication/check-username.command';
import { CheckIsFollowingCommand } from '@user/commands/follow/check-is-following.command';
import { USER_PROFILE_REPOSITORY } from '@user/repositories';
import { UserCoreService } from '@user/services/domain/user-core.service';
import { FollowStatus, UserEntity, UserStatus } from '@user/entities';
import { FOLLOW_STATUS } from '@contracts/user';

describe('UserGrpcController', () => {
   let controller: UserGrpcController;
   let commandBus: jest.Mocked<CommandBus>;
   let userCoreService: { getUserStats: jest.Mock };
   let userProfileRepository: { findAll: jest.Mock; count: jest.Mock };

   const mockUserEntity: UserEntity = {
      userId: 'user-123',
      accountId: 'acc-123',
      username: 'john_doe',
      displayName: 'John Doe',
      bio: 'Developer bio',
      avatar: 'https://example.com/avatar.jpg',
      coverImage: 'https://example.com/cover.jpg',
      website: 'https://example.com',
      location: 'Hanoi, Vietnam',
      status: UserStatus.ACTIVE,
      isPrivate: false,
      isVerified: true,
      followersCount: 15,
      followingCount: 10,
      postsCount: 3,
      recipesCount: 2,
      lastActiveAt: new Date('2026-10-20T00:00:00.000Z'),
      lastUsernameChangedAt: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-10-21T00:00:00.000Z'),
      deletedAt: null,
      profile: null,
      stats: null,
      settings: null,
   };

   beforeEach(async () => {
      const mockCommandBus = {
         execute: jest.fn(),
      };

      userProfileRepository = {
         findAll: jest.fn(),
         count: jest.fn(),
      };

      userCoreService = {
         getUserStats: jest.fn(),
      };

      const module: TestingModule = await Test.createTestingModule({
         controllers: [UserGrpcController],
         providers: [
            {
               provide: CommandBus,
               useValue: mockCommandBus,
            },
            {
               provide: USER_PROFILE_REPOSITORY,
               useValue: userProfileRepository,
            },
            {
               provide: UserCoreService,
               useValue: userCoreService,
            },
         ],
      }).compile();

      controller = module.get<UserGrpcController>(UserGrpcController);
      commandBus = module.get<CommandBus>(CommandBus) as jest.Mocked<CommandBus>;
   });

   it('should be defined', () => {
      expect(controller).toBeDefined();
   });

   it('should have GrpcLoggingInterceptor and GrpcMetricsInterceptor applied', () => {
      const interceptors = Reflect.getMetadata('__interceptors__', UserGrpcController);
      expect(interceptors).toBeDefined();
      expect(interceptors).toContain(GrpcLoggingInterceptor);
      expect(interceptors).toContain(GrpcMetricsInterceptor);
   });

   describe('checkUsername', () => {
      it('should execute CheckUsernameCommand and return availability result', async () => {
         const expectedResponse = {
            available: true,
            username: 'john_doe',
         };
         commandBus.execute.mockResolvedValue(expectedResponse);

         const result = await firstValueFrom(controller.checkUsername({ username: 'john_doe' }));

         expect(commandBus.execute).toHaveBeenCalledWith(new CheckUsernameCommand('john_doe'));
         expect(result).toEqual(expectedResponse);
      });

      it('should propagate error if command execution fails', async () => {
         const error = new Error('Username validation failed');
         commandBus.execute.mockRejectedValue(error);

         await expect(firstValueFrom(controller.checkUsername({ username: 'invalid_user' }))).rejects.toThrow(error);
      });
   });

   describe('searchUsers', () => {
      it('should execute SearchUsersCommand and map search results to Proto format', async () => {
         commandBus.execute.mockResolvedValue({
            items: [
               {
                  userId: 'user-123',
                  username: 'john_doe',
                  displayName: 'John Doe',
                  avatar: 'https://example.com/avatar.jpg',
                  bio: 'Developer bio',
                  isFollowing: true,
                  isFollower: false,
                  isSelf: false,
                  isVerified: true,
                  followersCount: 15,
                  followingCount: 10,
               },
            ],
            meta: {
               nextCursor: 'next-page-token',
               total: 1,
               hasMore: false,
               limit: 10,
            },
         });

         const result = await firstValueFrom(
            controller.searchUsers({ query: 'john', limit: 10, cursor: undefined, currentUserId: 'caller-1' }),
         );

         expect(commandBus.execute).toHaveBeenCalled();
         expect(result.items).toHaveLength(1);
         expect(result.items[0].userId).toBe('user-123');
         expect(result.items[0].username).toBe('john_doe');
         expect(result.items[0].isFollowing).toBe(true);
         expect(result.nextCursor).toBe('next-page-token');
         expect(result.total).toBe(1);
         expect(result.hasMore).toBe(false);
      });
   });

   describe('Social Graph & Follow operations', () => {
      it('should getFollowers and return Proto list', async () => {
         const mockFollow = {
            followId: 'f-1',
            followerId: 'u-1',
            followingId: 'user-123',
            status: FollowStatus.ACCEPTED,
            createdAt: new Date(),
            updatedAt: new Date(),
         };
         commandBus.execute.mockResolvedValue([mockFollow]);

         const result = await firstValueFrom(controller.getFollowers({ userId: 'user-123', skip: 0, take: 10 }));

         expect(commandBus.execute).toHaveBeenCalled();
         expect(result.items).toHaveLength(1);
         expect(result.items[0].followId).toBe('f-1');
         expect(result.total).toBe(1);
      });

      it('should getFollowing and return Proto list', async () => {
         const mockFollow = {
            followId: 'f-2',
            followerId: 'user-123',
            followingId: 'u-2',
            status: FollowStatus.ACCEPTED,
            createdAt: new Date(),
            updatedAt: new Date(),
         };
         commandBus.execute.mockResolvedValue([mockFollow]);

         const result = await firstValueFrom(controller.getFollowing({ userId: 'user-123' }));

         expect(commandBus.execute).toHaveBeenCalled();
         expect(result.items).toHaveLength(1);
         expect(result.items[0].followingId).toBe('u-2');
      });

      it('should getFollowersCount', async () => {
         commandBus.execute.mockResolvedValue({ count: 42 });

         const result = await firstValueFrom(controller.getFollowersCount({ userId: 'user-123' }));

         expect(result.userId).toBe('user-123');
         expect(result.count).toBe(42);
      });

      it('should getFollowingCount', async () => {
         commandBus.execute.mockResolvedValue({ count: 18 });

         const result = await firstValueFrom(controller.getFollowingCount({ userId: 'user-123' }));

         expect(result.userId).toBe('user-123');
         expect(result.count).toBe(18);
      });

      it('should getMutualFollowers', async () => {
         commandBus.execute.mockResolvedValue(['u-shared-1', 'u-shared-2']);

         const result = await firstValueFrom(controller.getMutualFollowers({ userId1: 'u-1', userId2: 'u-2' }));

         expect(result.mutualUserIds).toEqual(['u-shared-1', 'u-shared-2']);
         expect(result.total).toBe(2);
      });

      it('should acceptFollowRequest', async () => {
         commandBus.execute.mockResolvedValue({ followId: 'f-1', status: FollowStatus.ACCEPTED });

         const result = await firstValueFrom(controller.acceptFollowRequest({ followId: 'f-1' }));

         expect(result.success).toBe(true);
         expect(result.status).toBe(FollowStatus.ACCEPTED);
      });

      it('should rejectFollowRequest', async () => {
         commandBus.execute.mockResolvedValue({ followId: 'f-1', status: FollowStatus.REJECTED });

         const result = await firstValueFrom(controller.rejectFollowRequest({ followId: 'f-1' }));

         expect(result.success).toBe(true);
         expect(result.status).toBe(FollowStatus.REJECTED);
      });
   });

   describe('Internal Account Lookup & Lifecycle', () => {
      it('should getUserByAccountId', async () => {
         commandBus.execute.mockResolvedValue(mockUserEntity);

         const result = await firstValueFrom(controller.getUserByAccountId({ accountId: 'acc-123' }));

         expect(result.user?.userId).toBe('user-123');
         expect(result.user?.accountId).toBe('acc-123');
      });

      it('should getUserByUsername', async () => {
         commandBus.execute.mockResolvedValue(mockUserEntity);

         const result = await firstValueFrom(controller.getUserByUsername({ username: 'john_doe' }));

         expect(result.user?.userId).toBe('user-123');
         expect(result.user?.username).toBe('john_doe');
      });

      it('should restoreUser', async () => {
         commandBus.execute.mockResolvedValue(mockUserEntity);
         const metadata = createGrpcMetadata({
            userId: 'user-123',
            roles: [DEFAULT_ROLES.USER],
         });

         const result = await firstValueFrom(controller.restoreUser({ userId: 'user-123' }, metadata));

         expect(result.user?.userId).toBe('user-123');
      });
   });

   describe('getUserStats', () => {
      it('should return aggregated stats from userCoreService', async () => {
         userCoreService.getUserStats.mockResolvedValue({
            userId: 'user-123',
            postsCount: 12,
            followersCount: 150,
            followingCount: 80,
            recipesCount: 5,
            updatedAt: new Date(),
         });

         const result = await firstValueFrom(controller.getUserStats({ userId: 'user-123' }));

         expect(userCoreService.getUserStats).toHaveBeenCalledWith('user-123');
         expect(result.userId).toBe('user-123');
         expect(result.postsCount).toBe(12);
         expect(result.followersCount).toBe(150);
         expect(result.followingCount).toBe(80);
         expect(result.recipesCount).toBe(5);
      });

      it('should return 0 stats if projection is null/cold-start', async () => {
         userCoreService.getUserStats.mockResolvedValue(null);

         const result = await firstValueFrom(controller.getUserStats({ userId: 'user-empty' }));

         expect(result.userId).toBe('user-empty');
         expect(result.postsCount).toBe(0);
         expect(result.followersCount).toBe(0);
         expect(result.followingCount).toBe(0);
         expect(result.recipesCount).toBe(0);
      });
   });

   describe('checkIsFollowing', () => {
      it('should delegate to CheckIsFollowingCommand and return result', async () => {
         commandBus.execute.mockResolvedValueOnce({
            isFollowing: true,
            status: FOLLOW_STATUS.ACCEPTED,
         });

         const result = await firstValueFrom(
            controller.checkIsFollowing({ followerId: 'usr-1', followingId: 'usr-2' }),
         );

         expect(commandBus.execute).toHaveBeenCalledWith(expect.any(CheckIsFollowingCommand));
         expect(result.isFollowing).toBe(true);
         expect(result.status).toBe(FOLLOW_STATUS.ACCEPTED);
      });
   });
});
