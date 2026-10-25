import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SERVICES } from '@common';
import {
   MEDIA_EVENTS,
   type ITranscodeCompletedEvent,
   type ITranscodeFailedEvent,
   type ITranscodeRequestedEvent,
} from '@contracts/media';
import type { IMediaEventPublisher } from '@media/modules/transcoding/publishers/media-event.publisher.interface';

@Injectable()
export class MediaEventPublisher implements IMediaEventPublisher {
   private readonly logger = new Logger(MediaEventPublisher.name);

   constructor(
      @Optional()
      @Inject(SERVICES.MEDIA_SERVICE)
      private readonly mediaRmqClient?: ClientProxy,
      @Optional()
      private readonly eventEmitter?: EventEmitter2,
   ) {}

   publishTranscodeRequested(event: ITranscodeRequestedEvent): Promise<void> {
      try {
         this.logger.log(`Publishing transcode requested event for media ${event.mediaId}`);

         if (this.mediaRmqClient) {
            this.mediaRmqClient.emit(MEDIA_EVENTS.TRANSCODE_REQUESTED, event);
         } else if (this.eventEmitter) {
            this.eventEmitter.emit(MEDIA_EVENTS.TRANSCODE_REQUESTED, event);
         }
         return Promise.resolve();
      } catch (error) {
         this.logger.error(
            `Failed to publish transcode requested event for media ${event.mediaId}: ${(error as Error).message}`,
         );
         return Promise.reject(error instanceof Error ? error : new Error(String(error)));
      }
   }

   publishTranscodeCompleted(event: ITranscodeCompletedEvent): Promise<void> {
      try {
         this.logger.log(`Publishing transcode completed event for media ${event.mediaId}`);

         if (this.mediaRmqClient) {
            this.mediaRmqClient.emit(MEDIA_EVENTS.TRANSCODE_COMPLETED, event);
         } else if (this.eventEmitter) {
            this.eventEmitter.emit(MEDIA_EVENTS.TRANSCODE_COMPLETED, event);
         }
         return Promise.resolve();
      } catch (error) {
         this.logger.error(
            `Failed to publish transcode completed event for media ${event.mediaId}: ${(error as Error).message}`,
         );
         return Promise.reject(error instanceof Error ? error : new Error(String(error)));
      }
   }

   publishTranscodeFailed(event: ITranscodeFailedEvent): Promise<void> {
      try {
         this.logger.warn(`Publishing transcode failed event for media ${event.mediaId}: ${event.error}`);

         if (this.mediaRmqClient) {
            this.mediaRmqClient.emit(MEDIA_EVENTS.TRANSCODE_FAILED, event);
         } else if (this.eventEmitter) {
            this.eventEmitter.emit(MEDIA_EVENTS.TRANSCODE_FAILED, event);
         }
         return Promise.resolve();
      } catch (error) {
         this.logger.error(
            `Failed to publish transcode failed event for media ${event.mediaId}: ${(error as Error).message}`,
         );
         return Promise.reject(error instanceof Error ? error : new Error(String(error)));
      }
   }
}
