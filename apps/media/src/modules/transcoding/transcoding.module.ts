import { Module } from '@nestjs/common';
import { RmqModule, SERVICES } from '@common';
import { PrismaModule } from '@media/prisma';
import { StorageModule } from '@media/storage';
import { VideoTranscodeService } from '@media/modules/transcoding/video-transcode.service';
import { MediaEventPublisher } from '@media/modules/transcoding/publishers/media-event.publisher';
import { MEDIA_EVENT_PUBLISHER } from '@media/modules/transcoding/publishers/media-event.publisher.interface';
import { TranscodeEventConsumer } from '@media/modules/transcoding/consumers/transcode-event.consumer';
import { MediaRepository } from '@media/modules/media/repositories/media.repository';
import { MEDIA_REPOSITORY } from '@media/modules/media/repositories/media.repository.interface';

import { MediaConfigModule } from '@media/config';

@Module({
   imports: [
      MediaConfigModule,
      PrismaModule,
      StorageModule,
      RmqModule,
      RmqModule.register({ name: SERVICES.MEDIA_SERVICE }),
   ],
   controllers: [TranscodeEventConsumer],
   providers: [
      VideoTranscodeService,
      MediaEventPublisher,
      {
         provide: MEDIA_EVENT_PUBLISHER,
         useClass: MediaEventPublisher,
      },
      MediaRepository,
      {
         provide: MEDIA_REPOSITORY,
         useClass: MediaRepository,
      },
   ],
   exports: [VideoTranscodeService, MediaEventPublisher, MEDIA_EVENT_PUBLISHER],
})
export class TranscodingModule {}
