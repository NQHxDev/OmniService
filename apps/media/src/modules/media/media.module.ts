import { Module } from '@nestjs/common';
import { RmqModule } from '@common';
import { PrismaModule } from '@media/prisma';
import { StorageModule } from '@media/storage';
import { MediaGrpcController } from '@media/adapters/grpc/media-grpc.controller';
import { MediaService } from '@media/modules/media/media.service';
import { MediaRepository } from '@media/modules/media/repositories/media.repository';
import { MEDIA_REPOSITORY } from '@media/modules/media/repositories/media.repository.interface';
import { TranscodingModule } from '@media/modules/transcoding';

@Module({
   imports: [PrismaModule, StorageModule, RmqModule, TranscodingModule],
   controllers: [MediaGrpcController],
   providers: [
      MediaService,
      MediaRepository,
      {
         provide: MEDIA_REPOSITORY,
         useClass: MediaRepository,
      },
   ],
   exports: [MediaService, MediaRepository, MEDIA_REPOSITORY],
})
export class MediaDomainModule {}
