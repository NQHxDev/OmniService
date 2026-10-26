import { Inject, Injectable, Optional } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { UploadUrlResponseDto } from '@contracts/media';
import { UserEntity } from '@user/entities';
import { USER_DOMAIN_EVENTS } from '@user/domain/events';
import { USER_DOMAIN_EVENT_FACTORY } from '@user/constants';
import { UserDomainEventFactory } from '@user/factories/user-domain-event.factory';
import type { IUserDomainEventFactory } from '@user/factories/user-domain-event.factory.interface';
import { ProfileQueryService } from '@user/services/domain/profile-query.service';
import { ProfileLifecycleService } from '@user/services/domain/profile-lifecycle.service';
import { MEDIA_ADAPTER, type IMediaAdapter } from '@user/adapters/media';

/**
 * ProfileAvatarService handles media-related profile operations,
 * such as uploading user avatars and generating direct S3/Cloudinary upload signatures.
 *
 * Decoupled from transport concerns via IMediaAdapter port.
 */
@Injectable()
export class ProfileAvatarService {
   private readonly domainEventFactory: IUserDomainEventFactory;

   constructor(
      private readonly profileQueryService: ProfileQueryService,
      private readonly profileLifecycleService: ProfileLifecycleService,
      @Inject(MEDIA_ADAPTER)
      private readonly mediaAdapter: IMediaAdapter,
      @Optional()
      private readonly eventEmitter?: EventEmitter2,
      @Optional()
      @Inject(USER_DOMAIN_EVENT_FACTORY)
      domainEventFactory?: IUserDomainEventFactory,
   ) {
      this.domainEventFactory = domainEventFactory ?? new UserDomainEventFactory();
   }

   async uploadAvatar(
      userId: string,
      base64Data: string,
      mimeType?: string,
   ): Promise<{ avatarUrl: string; publicId: string; user: UserEntity }> {
      const user = await this.profileQueryService.getUserById(userId);

      const uploadResult = await this.mediaAdapter.uploadAvatar({
         userId: user.userId,
         fileBase64: base64Data,
         mimeType,
      });

      const updatedUser = await this.profileLifecycleService.updateUserProfile(user.userId, {
         avatar: uploadResult.url,
      });

      if (this.eventEmitter) {
         this.eventEmitter.emit(
            USER_DOMAIN_EVENTS.AVATAR_UPLOADED,
            this.domainEventFactory.createAvatarUploaded(user.userId, uploadResult.url),
         );
      }

      return {
         avatarUrl: uploadResult.url,
         publicId: uploadResult.key,
         user: updatedUser,
      };
   }

   async getAvatarUploadSignature(userId: string): Promise<UploadUrlResponseDto> {
      const user = await this.profileQueryService.getUserById(userId);
      return this.mediaAdapter.getAvatarUploadSignature(user.userId);
   }
}
