import { Controller, Inject, Logger } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import { OnEvent } from '@nestjs/event-emitter';
import { RmqService, SERVICES } from '@common';
import {
   MEDIA_EVENTS,
   MEDIA_STATUSES,
   type ITranscodeCompletedEvent,
   type ITranscodeFailedEvent,
   type ITranscodeRequestedEvent,
} from '@contracts/media';
import { VideoTranscodeService } from '@media/modules/transcoding/video-transcode.service';
import {
   MEDIA_EVENT_PUBLISHER,
   type IMediaEventPublisher,
} from '@media/modules/transcoding/publishers/media-event.publisher.interface';
import { MEDIA_REPOSITORY, type IMediaRepository } from '@media/modules/media/repositories/media.repository.interface';
import { DiskGuardService } from '@media/modules/transcoding/services/disk-guard.service';

@Controller()
export class TranscodeEventConsumer {
   private readonly logger = new Logger(TranscodeEventConsumer.name);
   private readonly activeTranscodeJobs = new Set<string>();

   constructor(
      private readonly videoTranscodeService: VideoTranscodeService,
      @Inject(MEDIA_EVENT_PUBLISHER)
      private readonly eventPublisher: IMediaEventPublisher,
      @Inject(MEDIA_REPOSITORY)
      private readonly mediaRepository: IMediaRepository,
      private readonly rmqService: RmqService,
      private readonly diskGuardService: DiskGuardService,
   ) {}

   @EventPattern(MEDIA_EVENTS.TRANSCODE_REQUESTED)
   async handleTranscodeRequestedFromRmq(
      @Payload() data: ITranscodeRequestedEvent,
      @Ctx() context?: RmqContext,
   ): Promise<void> {
      // 1. Backpressure Pre-flight Check: verify scratch disk headroom before picking up job
      const hasSpace = await this.diskGuardService.hasSufficientSpace();
      if (!hasSpace) {
         this.logger.warn(
            `Insufficient scratch disk space to process transcode job for media ${data.mediaId}. Requeueing back to RabbitMQ for backpressure.`,
         );
         if (context) {
            this.rmqService.nack(context, true);
         }
         return;
      }

      await this.processTranscodeJob(data, context);
   }

   @OnEvent(MEDIA_EVENTS.TRANSCODE_REQUESTED)
   async handleTranscodeRequestedFromLocal(data: ITranscodeRequestedEvent): Promise<void> {
      await this.processTranscodeJob(data);
   }

   private async processTranscodeJob(data: ITranscodeRequestedEvent, context?: RmqContext): Promise<void> {
      if (this.activeTranscodeJobs.has(data.mediaId)) {
         this.logger.warn(`Transcode job for media ${data.mediaId} is already running in this worker`);
         if (context) {
            this.rmqService.nack(context, true);
         }
         return;
      }

      this.activeTranscodeJobs.add(data.mediaId);
      this.logger.log(`Worker picked up transcode job for media ${data.mediaId} (key: ${data.key})`);

      try {
         // Execute transcoding pipeline
         const result = await this.videoTranscodeService.transcodeVideo(data.mediaId, data.key);
         await this.eventPublisher.publishTranscodeCompleted(result);

         // Manual ACK ONLY after successful completion
         if (context) {
            this.rmqService.ack(context);
         }
      } catch (error) {
         const errorMessage = error instanceof Error ? error.message : String(error);
         this.logger.error(`Worker failed transcoding for media ${data.mediaId}: ${errorMessage}`);

         await this.eventPublisher.publishTranscodeFailed({
            mediaId: data.mediaId,
            error: errorMessage,
         });

         if (context) {
            await this.rmqService.handleError(error, context, { queue: SERVICES.MEDIA_SERVICE });
         }
      } finally {
         this.activeTranscodeJobs.delete(data.mediaId);
      }
   }

   @EventPattern(MEDIA_EVENTS.TRANSCODE_COMPLETED)
   async handleTranscodeCompletedFromRmq(
      @Payload() data: ITranscodeCompletedEvent,
      @Ctx() context?: RmqContext,
   ): Promise<void> {
      try {
         await this.applyTranscodeCompleted(data);
         if (context) {
            this.rmqService.ack(context);
         }
      } catch (error) {
         this.logger.error(`Failed to handle transcode completed event: ${(error as Error).message}`);
         if (context) {
            await this.rmqService.handleError(error, context, { queue: SERVICES.MEDIA_SERVICE });
         }
      }
   }

   @OnEvent(MEDIA_EVENTS.TRANSCODE_COMPLETED)
   async handleTranscodeCompletedFromLocal(data: ITranscodeCompletedEvent): Promise<void> {
      await this.applyTranscodeCompleted(data);
   }

   private async applyTranscodeCompleted(data: ITranscodeCompletedEvent): Promise<void> {
      const media = await this.mediaRepository.findById(data.mediaId);
      if (!media) {
         this.logger.warn(`Media ${data.mediaId} not found when applying completed transcode state`);
         return;
      }

      const existingMetadata = (media.metadata as Record<string, unknown>) || {};
      await this.mediaRepository.update(data.mediaId, {
         status: MEDIA_STATUSES.READY,
         url: data.hlsMasterUrl,
         metadata: {
            ...existingMetadata,
            hlsMasterUrl: data.hlsMasterUrl,
            thumbnailUrl: data.thumbnailUrl,
            duration: data.duration,
            resolutions: data.resolutions,
         },
      });

      this.logger.log(`Media ${data.mediaId} transitioned to READY with HLS Master: ${data.hlsMasterUrl}`);
   }

   @EventPattern(MEDIA_EVENTS.TRANSCODE_FAILED)
   async handleTranscodeFailedFromRmq(
      @Payload() data: ITranscodeFailedEvent,
      @Ctx() context?: RmqContext,
   ): Promise<void> {
      try {
         await this.applyTranscodeFailed(data);
         if (context) {
            this.rmqService.ack(context);
         }
      } catch (error) {
         this.logger.error(`Failed to handle transcode failed event: ${(error as Error).message}`);
         if (context) {
            await this.rmqService.handleError(error, context, { queue: SERVICES.MEDIA_SERVICE });
         }
      }
   }

   @OnEvent(MEDIA_EVENTS.TRANSCODE_FAILED)
   async handleTranscodeFailedFromLocal(data: ITranscodeFailedEvent): Promise<void> {
      await this.applyTranscodeFailed(data);
   }

   private async applyTranscodeFailed(data: ITranscodeFailedEvent): Promise<void> {
      const media = await this.mediaRepository.findById(data.mediaId);
      if (!media) {
         this.logger.warn(`Media ${data.mediaId} not found when applying failed transcode state`);
         return;
      }

      const existingMetadata = (media.metadata as Record<string, unknown>) || {};
      await this.mediaRepository.update(data.mediaId, {
         status: MEDIA_STATUSES.FAILED,
         metadata: {
            ...existingMetadata,
            transcodeError: data.error,
         },
      });

      this.logger.warn(`Media ${data.mediaId} transitioned to FAILED: ${data.error}`);
   }
}
