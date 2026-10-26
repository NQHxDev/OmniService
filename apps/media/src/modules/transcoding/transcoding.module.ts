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
import { DiskGuardService } from '@media/modules/transcoding/services/disk-guard.service';
import { DISK_GUARD_SERVICE } from '@media/modules/transcoding/services/disk-guard.service.interface';
import { SinglePassFfmpegStrategy } from '@media/modules/transcoding/strategies/single-pass-ffmpeg.strategy';
import { CloudManagedTranscodeAdapter } from '@media/modules/transcoding/strategies/cloud-managed-transcode.adapter';
import { TranscodeStrategyFactory } from '@media/modules/transcoding/strategies/transcode-strategy.factory';

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
      DiskGuardService,
      {
         provide: DISK_GUARD_SERVICE,
         useClass: DiskGuardService,
      },
      SinglePassFfmpegStrategy,
      CloudManagedTranscodeAdapter,
      TranscodeStrategyFactory,
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
   exports: [
      VideoTranscodeService,
      MediaEventPublisher,
      MEDIA_EVENT_PUBLISHER,
      DiskGuardService,
      DISK_GUARD_SERVICE,
      TranscodeStrategyFactory,
   ],
})
export class TranscodingModule {}
