import { Injectable, Logger } from '@nestjs/common';
import {
   ANALYZE_ERROR_CODES,
   ANALYZE_RESPONSE_MESSAGES,
   GetUserInterestsDto,
   IGetUserInterestsResponse,
   IRecordWatchSessionResponse,
   RecordWatchSessionDto,
} from '@contracts/analyze';
import { WatchSessionRepository } from '@analyze/repositories/watch-session.repository';
import { AnalyzeCacheService } from '@analyze/services/analyze-cache.service';
import { ScoringStrategy } from '@analyze/services/scoring.strategy';

@Injectable()
export class AnalyzeService {
   private readonly logger = new Logger(AnalyzeService.name);

   constructor(
      private readonly sessionRepo: WatchSessionRepository,
      private readonly cacheService: AnalyzeCacheService,
      private readonly scoringStrategy: ScoringStrategy,
   ) {}

   /**
    * Records video watch session:
    * 1. Validates user identity.
    * 2. Evaluates behavior score based on duration, completion rate & loops.
    * 3. Real-time updates to Redis User Category Affinity score (ZSET) and seen videos.
    * 4. Persists raw watch session into Postgres database with fault tolerance.
    */
   async recordWatchSession(dto: RecordWatchSessionDto): Promise<IRecordWatchSessionResponse> {
      const userId = dto.userId;
      if (!userId) {
         this.logger.warn(`Watch session dropped: missing userId for video=${dto.videoId}`);
         return {
            success: false,
            message: ANALYZE_ERROR_CODES.INVALID_SESSION_DATA,
            calculatedScoreDelta: 0,
         };
      }

      const { completionRate, scoreDelta } = this.scoringStrategy.calculateScore({
         watchDurationMs: dto.watchDurationMs,
         videoDurationMs: dto.videoDurationMs,
         isCompleted: Boolean(dto.isCompleted),
         loopCount: dto.loopCount ?? 0,
      });

      const categoryIds = dto.categoryIds ?? [];
      const tagIds = dto.tagIds ?? [];

      // 1. Real-time updates to Redis Cache (instant recommendation ingestion)
      await Promise.all([
         this.cacheService.updateCategoryAffinity(userId, categoryIds, scoreDelta),
         this.cacheService.markVideoAsSeen(userId, dto.videoId),
      ]);

      // 2. Persist to Postgres (isolated so transient DB load does not interrupt telemetry pipeline)
      try {
         await this.sessionRepo.create({
            sessionId: dto.sessionId,
            userId,
            videoId: dto.videoId,
            watchDurationMs: dto.watchDurationMs,
            videoDurationMs: dto.videoDurationMs,
            completionRate,
            isCompleted: Boolean(dto.isCompleted),
            loopCount: dto.loopCount ?? 0,
            calculatedScore: scoreDelta,
            categoryIds,
            tagIds,
         });
      } catch (error) {
         this.logger.error(
            `Failed to persist watch session for user=${userId}, video=${dto.videoId}: ${(error as Error).message}`,
            (error as Error).stack,
         );
      }

      this.logger.debug(
         `User ${userId} watched ${dto.videoId}: delta=${scoreDelta}, categories=${categoryIds.join(',')}`,
      );

      return {
         success: true,
         message: ANALYZE_RESPONSE_MESSAGES.RECORD_SESSION_SUCCESS,
         calculatedScoreDelta: scoreDelta,
      };
   }

   /**
    * Returns the user's top interested categories and recently seen videos.
    * Called by recommendation/feed services to boost appropriate content.
    */
   async getUserInterests(dto: GetUserInterestsDto): Promise<IGetUserInterestsResponse> {
      const safeLimit = dto.limit && dto.limit > 0 ? dto.limit : 5;
      const [topCategories, seenVideoIds] = await Promise.all([
         this.cacheService.getTopCategories(dto.userId, safeLimit),
         this.cacheService.getSeenVideoIds(dto.userId),
      ]);

      return {
         userId: dto.userId,
         topCategories,
         seenVideoIds,
      };
   }
}
