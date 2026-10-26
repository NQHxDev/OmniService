import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ProfileAvatarService } from '@user/services/domain/profile-avatar.service';
import { ProfileQueryService } from '@user/services/domain/profile-query.service';
import { ProfileLifecycleService } from '@user/services/domain/profile-lifecycle.service';
import { MEDIA_ADAPTER, type IMediaAdapter } from '@user/adapters/media/media.adapter.interface';
import {
   MEDIA_PROVIDERS,
   MEDIA_TYPES,
   MEDIA_STATUSES,
   type MediaResponseDto,
   type UploadUrlResponseDto,
} from '@contracts/media';
import { UserEntity, UserStatus } from '@user/entities';
import { USER_DOMAIN_EVENTS } from '@user/domain/events';

describe('ProfileAvatarService (Domain)', () => {
   let service: ProfileAvatarService;

   const mockMediaAdapter: jest.Mocked<IMediaAdapter> = {
      uploadAvatar: jest.fn(),
      getAvatarUploadSignature: jest.fn(),
   };

   const mockProfileQueryService = {
      getUserById: jest.fn(),
   };

   const mockProfileLifecycleService = {
      updateUserProfile: jest.fn(),
   };

   const mockEventEmitter = {
      emit: jest.fn(),
   };

   beforeEach(async () => {
      jest.clearAllMocks();

      const module: TestingModule = await Test.createTestingModule({
         providers: [
            ProfileAvatarService,
            {
               provide: MEDIA_ADAPTER,
               useValue: mockMediaAdapter,
            },
            {
               provide: ProfileQueryService,
               useValue: mockProfileQueryService,
            },
            {
               provide: ProfileLifecycleService,
               useValue: mockProfileLifecycleService,
            },
            {
               provide: EventEmitter2,
               useValue: mockEventEmitter,
            },
         ],
      }).compile();

      service = module.get<ProfileAvatarService>(ProfileAvatarService);
   });

   it('should be defined', () => {
      expect(service).toBeDefined();
   });

   it('should upload avatar and emit domain event via media adapter', async () => {
      const user = new UserEntity({
         userId: 'u1',
         accountId: 'acc1',
         status: UserStatus.ACTIVE,
      });
      const updatedUser = new UserEntity({
         userId: 'u1',
         avatar: 'https://cdn.example.com/avatar.jpg',
         status: UserStatus.ACTIVE,
      });

      mockProfileQueryService.getUserById.mockResolvedValue(user);
      const mockUploadedMedia: MediaResponseDto = {
         id: 'media_uuid_123',
         userId: 'u1',
         provider: MEDIA_PROVIDERS.CLOUDFLARE_R2,
         type: MEDIA_TYPES.IMAGE,
         url: 'https://cdn.example.com/avatar.jpg',
         key: 'key123',
         size: 1024,
         mimeType: 'image/png',
         status: MEDIA_STATUSES.READY,
         createdAt: new Date(),
         updatedAt: new Date(),
      };
      mockMediaAdapter.uploadAvatar.mockResolvedValue(mockUploadedMedia);
      mockProfileLifecycleService.updateUserProfile.mockResolvedValue(updatedUser);

      const result = await service.uploadAvatar('u1', 'base64EncodedData', 'image/png');

      expect(result).toEqual({
         avatarUrl: 'https://cdn.example.com/avatar.jpg',
         publicId: 'key123',
         user: updatedUser,
      });
      expect(mockMediaAdapter.uploadAvatar).toHaveBeenCalledWith({
         userId: 'u1',
         fileBase64: 'base64EncodedData',
         mimeType: 'image/png',
      });
      expect(mockProfileLifecycleService.updateUserProfile).toHaveBeenCalledWith('u1', {
         avatar: 'https://cdn.example.com/avatar.jpg',
      });
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
         USER_DOMAIN_EVENTS.AVATAR_UPLOADED,
         expect.objectContaining({ userId: 'u1', avatarUrl: 'https://cdn.example.com/avatar.jpg' }),
      );
   });

   it('should get avatar upload signature via media adapter', async () => {
      const user = new UserEntity({
         userId: 'u1',
         accountId: 'acc1',
         status: UserStatus.ACTIVE,
      });
      mockProfileQueryService.getUserById.mockResolvedValue(user);
      const mockUploadUrlResponse: UploadUrlResponseDto = {
         mediaId: 'media_uuid_pending_1',
         provider: MEDIA_PROVIDERS.CLOUDFLARE_R2,
         method: 'PUT',
         uploadUrl: 'https://s3.amazonaws.com/presigned',
         key: 'sig-key',
      };
      mockMediaAdapter.getAvatarUploadSignature.mockResolvedValue(mockUploadUrlResponse);

      const result = await service.getAvatarUploadSignature('u1');
      expect(result).toEqual(mockUploadUrlResponse);
      expect(mockMediaAdapter.getAvatarUploadSignature).toHaveBeenCalledWith('u1');
   });
});
