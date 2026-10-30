import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import { CORRELATION_ID_HEADER, DEFAULT_ROLES, type JwtPayload } from '@common';
import {
   ANALYZE_RESPONSE_MESSAGES,
   type GetUserInterestsResponseDto,
   type RecordWatchSessionDto,
   type RecordWatchSessionResponseDto,
} from '@contracts/analyze';
import { AnalyzeController } from '@/modules/analyze/analyze.controller';
import { AnalyzeService } from '@/modules/analyze/analyze.service';

describe('AnalyzeController', () => {
   let controller: AnalyzeController;
   const mockAnalyzeService = {
      recordWatchSession: jest.fn(),
      getUserInterests: jest.fn(),
   };

   const mockUser: JwtPayload = {
      sub: 'user-uuid-1',
      email: 'user@example.com',
      roles: [DEFAULT_ROLES.USER],
   };

   const mockReq = {
      headers: {
         [CORRELATION_ID_HEADER]: 'test-corr-id',
      },
   } as unknown as Request;

   beforeEach(async () => {
      jest.clearAllMocks();

      const module: TestingModule = await Test.createTestingModule({
         controllers: [AnalyzeController],
         providers: [
            {
               provide: AnalyzeService,
               useValue: mockAnalyzeService,
            },
         ],
      }).compile();

      controller = module.get<AnalyzeController>(AnalyzeController);
   });

   it('should be defined', () => {
      expect(controller).toBeDefined();
   });

   describe('recordWatchSession', () => {
      it('should delegate recordWatchSession to AnalyzeService with user context', async () => {
         const dto: RecordWatchSessionDto = {
            videoId: 'vid-123',
            watchDurationMs: 30000,
            videoDurationMs: 60000,
            isCompleted: false,
            loopCount: 0,
            categoryIds: ['cooking'],
            tagIds: ['recipe'],
         };

         const expectedResult: RecordWatchSessionResponseDto = {
            success: true,
            message: ANALYZE_RESPONSE_MESSAGES.RECORD_SESSION_SUCCESS,
            calculatedScoreDelta: 1,
         };

         mockAnalyzeService.recordWatchSession.mockResolvedValue(expectedResult);

         const result = await controller.recordWatchSession(dto, mockUser, mockReq);

         expect(mockAnalyzeService.recordWatchSession).toHaveBeenCalledWith(dto, mockUser, {
            correlationId: 'test-corr-id',
         });
         expect(result).toEqual(expectedResult);
      });
   });

   describe('getUserInterests', () => {
      it('should retrieve current user interests', async () => {
         const expectedResult: GetUserInterestsResponseDto = {
            userId: 'user-uuid-1',
            topCategories: [{ categoryId: 'cooking', score: 12 }],
            seenVideoIds: ['vid-1'],
         };

         mockAnalyzeService.getUserInterests.mockResolvedValue(expectedResult);

         const result = await controller.getUserInterests({ limit: 5 }, mockUser, mockReq);

         expect(mockAnalyzeService.getUserInterests).toHaveBeenCalledWith('user-uuid-1', 5, {
            correlationId: 'test-corr-id',
         });
         expect(result).toEqual(expectedResult);
      });
   });

   describe('getUserInterestsByUserId', () => {
      it('should retrieve user interests by path parameter', async () => {
         const expectedResult: GetUserInterestsResponseDto = {
            userId: 'target-user-uuid',
            topCategories: [{ categoryId: 'baking', score: 25 }],
            seenVideoIds: ['vid-2'],
         };

         mockAnalyzeService.getUserInterests.mockResolvedValue(expectedResult);

         const result = await controller.getUserInterestsByUserId('target-user-uuid', { limit: 10 }, mockReq);

         expect(mockAnalyzeService.getUserInterests).toHaveBeenCalledWith('target-user-uuid', 10, {
            correlationId: 'test-corr-id',
         });
         expect(result).toEqual(expectedResult);
      });
   });
});
