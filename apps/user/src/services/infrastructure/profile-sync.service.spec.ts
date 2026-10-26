import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ProfileSyncService } from '@user/services/infrastructure/profile-sync.service';
import { OutboxService } from '@user/outbox';
import { UsernameBloomFilterService } from '@user/services/infrastructure/username-bloom-filter.service';
import { UserGraphSyncService } from '@user/services/infrastructure/user-graph-sync.service';
import { SEARCH_ADAPTER, type ISearchAdapter } from '@user/adapters/search/search.adapter.interface';
import { UserEntity, UserStatus } from '@user/entities';
import { USER_AGGREGATES, USER_EVENTS, USER_OUTBOX_EVENTS } from '@contracts/user';
import { USER_DOMAIN_EVENTS } from '@user/domain/events';

describe('ProfileSyncService (Infrastructure)', () => {
   let service: ProfileSyncService;

   const mockSearchAdapter: jest.Mocked<ISearchAdapter> = {
      searchUsers: jest.fn(),
      emitIndexEvent: jest.fn(),
   };

   const mockOutboxService = {
      createOutboxEvent: jest.fn().mockResolvedValue({ id: 'outbox-1' }),
   };

   const mockUserGraphSyncService = {
      syncUserToGraph: jest.fn().mockResolvedValue(undefined),
   };

   const mockUsernameBloomFilterService = {
      addUsername: jest.fn().mockResolvedValue(undefined),
      updateUsername: jest.fn().mockResolvedValue(undefined),
   };

   const mockEventEmitter = {
      emit: jest.fn(),
   };

   beforeEach(async () => {
      jest.clearAllMocks();

      const module: TestingModule = await Test.createTestingModule({
         providers: [
            ProfileSyncService,
            {
               provide: SEARCH_ADAPTER,
               useValue: mockSearchAdapter,
            },
            {
               provide: OutboxService,
               useValue: mockOutboxService,
            },
            {
               provide: UserGraphSyncService,
               useValue: mockUserGraphSyncService,
            },
            {
               provide: UsernameBloomFilterService,
               useValue: mockUsernameBloomFilterService,
            },
            {
               provide: EventEmitter2,
               useValue: mockEventEmitter,
            },
         ],
      }).compile();

      service = module.get<ProfileSyncService>(ProfileSyncService);
   });

   it('should be defined', () => {
      expect(service).toBeDefined();
   });

   it('should synchronize user created with all external targets via search adapter', async () => {
      const user = new UserEntity({
         userId: 'u1',
         accountId: 'acc1',
         username: 'newuser',
         displayName: 'New User',
         createdAt: new Date(),
         status: UserStatus.ACTIVE,
      });

      await service.syncUserCreated(user);

      expect(mockUsernameBloomFilterService.addUsername).toHaveBeenCalledWith('newuser');
      expect(mockUserGraphSyncService.syncUserToGraph).toHaveBeenCalledWith(user);
      expect(mockOutboxService.createOutboxEvent).toHaveBeenCalledWith(
         'u1',
         USER_AGGREGATES.USER,
         USER_OUTBOX_EVENTS.USER_CREATED,
         expect.objectContaining({ userId: 'u1', username: 'newuser' }),
      );
      expect(mockSearchAdapter.emitIndexEvent).toHaveBeenCalledWith(
         USER_EVENTS.CREATED,
         expect.objectContaining({ userId: 'u1' }),
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
         USER_DOMAIN_EVENTS.USER_CREATED,
         expect.objectContaining({ userId: 'u1', username: 'newuser' }),
      );
   });

   it('should synchronize user updated and emit username changed if modified', async () => {
      const previousUser = new UserEntity({
         userId: 'u1',
         accountId: 'acc1',
         username: 'oldusername',
         status: UserStatus.ACTIVE,
      });

      const updatedUser = new UserEntity({
         userId: 'u1',
         accountId: 'acc1',
         username: 'newusername',
         updatedAt: new Date(),
         status: UserStatus.ACTIVE,
      });

      await service.syncUserUpdated(updatedUser, { username: 'newusername' }, previousUser);

      expect(mockUsernameBloomFilterService.updateUsername).toHaveBeenCalledWith('newusername', 'oldusername');
      expect(mockUserGraphSyncService.syncUserToGraph).toHaveBeenCalledWith(updatedUser);
      expect(mockOutboxService.createOutboxEvent).toHaveBeenCalledWith(
         'u1',
         USER_AGGREGATES.USER,
         USER_OUTBOX_EVENTS.USER_UPDATED,
         expect.objectContaining({
            userId: 'u1',
            accountId: 'acc1',
            field: 'username',
            oldValue: 'oldusername',
            newValue: 'newusername',
         }),
      );
      expect(mockSearchAdapter.emitIndexEvent).toHaveBeenCalledWith(
         USER_EVENTS.UPDATED,
         expect.objectContaining({ userId: 'u1' }),
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
         USER_DOMAIN_EVENTS.USERNAME_CHANGED,
         expect.objectContaining({ userId: 'u1', oldUsername: 'oldusername', newUsername: 'newusername' }),
      );
   });

   it('should synchronize user deleted', async () => {
      await service.syncUserDeleted('u1', 'acc1');

      expect(mockSearchAdapter.emitIndexEvent).toHaveBeenCalledWith(USER_EVENTS.DELETED, { userId: 'u1' });
      expect(mockOutboxService.createOutboxEvent).toHaveBeenCalledWith(
         'u1',
         USER_AGGREGATES.USER,
         USER_OUTBOX_EVENTS.USER_DELETED,
         { userId: 'u1', accountId: 'acc1' },
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
         USER_DOMAIN_EVENTS.USER_DELETED,
         expect.objectContaining({ userId: 'u1', accountId: 'acc1' }),
      );
   });

   it('should synchronize user restored', async () => {
      const user = new UserEntity({
         userId: 'u1',
         accountId: 'acc1',
         status: UserStatus.ACTIVE,
      });

      await service.syncUserRestored(user);

      expect(mockSearchAdapter.emitIndexEvent).toHaveBeenCalledWith(
         USER_EVENTS.CREATED,
         expect.objectContaining({ userId: 'u1' }),
      );
      expect(mockOutboxService.createOutboxEvent).toHaveBeenCalledWith(
         'u1',
         USER_AGGREGATES.USER,
         USER_OUTBOX_EVENTS.USER_RESTORED,
         { userId: 'u1', accountId: 'acc1' },
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
         USER_DOMAIN_EVENTS.USER_RESTORED,
         expect.objectContaining({ userId: 'u1', accountId: 'acc1' }),
      );
   });
});
