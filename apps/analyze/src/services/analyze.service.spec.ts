import { AnalyzeService } from './analyze.service';
import { WatchSessionRepository } from '@analyze/repositories/watch-session.repository';
import { AnalyzeCacheService } from './analyze-cache.service';
import { ScoringStrategy } from './scoring.strategy';
import { ANALYZE_ERROR_CODES, ANALYZE_RESPONSE_MESSAGES } from '@contracts/analyze';

describe('AnalyzeService', () => {
   let service: AnalyzeService;
   let mockSessionRepo: jest.Mocked<WatchSessionRepository>;
   let mockCacheService: jest.Mocked<AnalyzeCacheService>;
   let scoringStrategy: ScoringStrategy;

   beforeEach(() => {
      mockSessionRepo = {
         create: jest.fn().mockResolvedValue({} as any),
         findRecentSessionsByUserId: jest.fn().mockResolvedValue([]),
      } as unknown as jest.Mocked<WatchSessionRepository>;

      mockCacheService = {
         updateCategoryAffinity: jest.fn().mockResolvedValue(undefined),
         markVideoAsSeen: jest.fn().mockResolvedValue(undefined),
         getTopCategories: jest.fn().mockResolvedValue([{ categoryId: 'tech', score: 5 }]),
         getSeenVideoIds: jest.fn().mockResolvedValue(['vid-1', 'vid-2']),
      } as unknown as jest.Mocked<AnalyzeCacheService>;

      scoringStrategy = new ScoringStrategy();

      service = new AnalyzeService(mockSessionRepo, mockCacheService, scoringStrategy);
   });

   it('should reject session if userId is missing', async () => {
      const response = await service.recordWatchSession({
         videoId: 'vid-123',
         watchDurationMs: 5000,
         videoDurationMs: 10000,
      });

      expect(response.success).toBe(false);
      expect(response.message).toBe(ANALYZE_ERROR_CODES.INVALID_SESSION_DATA);
      expect(mockCacheService.updateCategoryAffinity).not.toHaveBeenCalled();
      expect(mockSessionRepo.create).not.toHaveBeenCalled();
   });

   it('should process watch session, update cache and persist to repo', async () => {
      const response = await service.recordWatchSession({
         userId: 'usr-1',
         videoId: 'vid-123',
         watchDurationMs: 25000,
         videoDurationMs: 30000,
         isCompleted: true,
         loopCount: 1,
         categoryIds: ['tech', 'gadgets'],
         tagIds: ['phone'],
      });

      expect(response.success).toBe(true);
      expect(response.message).toBe(ANALYZE_RESPONSE_MESSAGES.RECORD_SESSION_SUCCESS);
      expect(response.calculatedScoreDelta).toBeGreaterThan(0);

      expect(mockCacheService.updateCategoryAffinity).toHaveBeenCalledWith(
         'usr-1',
         ['tech', 'gadgets'],
         response.calculatedScoreDelta,
      );
      expect(mockCacheService.markVideoAsSeen).toHaveBeenCalledWith('usr-1', 'vid-123');
      expect(mockSessionRepo.create).toHaveBeenCalled();
   });

   it('should tolerate database persistence error without failing cache updates', async () => {
      mockSessionRepo.create.mockRejectedValue(new Error('DB Connection Timeout'));

      const response = await service.recordWatchSession({
         userId: 'usr-1',
         videoId: 'vid-123',
         watchDurationMs: 25000,
         videoDurationMs: 30000,
         categoryIds: ['tech'],
      });

      expect(response.success).toBe(true);
      expect(mockCacheService.updateCategoryAffinity).toHaveBeenCalled();
      expect(mockCacheService.markVideoAsSeen).toHaveBeenCalled();
   });

   it('should return user interests combining top categories and seen videos', async () => {
      const response = await service.getUserInterests({
         userId: 'usr-1',
         limit: 3,
      });

      expect(response.userId).toBe('usr-1');
      expect(response.topCategories).toEqual([{ categoryId: 'tech', score: 5 }]);
      expect(response.seenVideoIds).toEqual(['vid-1', 'vid-2']);
      expect(mockCacheService.getTopCategories).toHaveBeenCalledWith('usr-1', 3);
      expect(mockCacheService.getSeenVideoIds).toHaveBeenCalledWith('usr-1');
   });
});
