import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import {
   ANALYZE_V1_GRPC_METHODS,
   ANALYZE_V1_GRPC_SERVICE_NAME,
   type IGetUserInterestsRequest,
   type IGetUserInterestsResponse,
   type IRecordWatchSessionRequest,
   type IRecordWatchSessionResponse,
} from '@contracts/analyze';
import { AnalyzeService } from '@analyze/services/analyze.service';

@Controller()
export class AnalyzeGrpcController {
   constructor(private readonly analyzeService: AnalyzeService) {}

   @GrpcMethod(ANALYZE_V1_GRPC_SERVICE_NAME, ANALYZE_V1_GRPC_METHODS.GET_USER_INTERESTS)
   async getUserInterests(request: IGetUserInterestsRequest): Promise<IGetUserInterestsResponse> {
      return this.analyzeService.getUserInterests({
         userId: request.userId,
         limit: request.limit && request.limit > 0 ? request.limit : 5,
      });
   }

   @GrpcMethod(ANALYZE_V1_GRPC_SERVICE_NAME, ANALYZE_V1_GRPC_METHODS.RECORD_WATCH_SESSION)
   async recordWatchSession(request: IRecordWatchSessionRequest): Promise<IRecordWatchSessionResponse> {
      return this.analyzeService.recordWatchSession({
         sessionId: request.sessionId,
         userId: request.userId,
         videoId: request.videoId,
         watchDurationMs: Math.max(0, request.watchDurationMs || 0),
         videoDurationMs: Math.max(1, request.videoDurationMs || 1),
         isCompleted: Boolean(request.isCompleted),
         loopCount: Math.max(0, request.loopCount || 0),
         categoryIds: request.categoryIds || [],
         tagIds: request.tagIds || [],
         intervals: request.intervals || [],
      });
   }
}
