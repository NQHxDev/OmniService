import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { defer, firstValueFrom } from 'rxjs';
import {
   CircuitBreakerRegistry,
   createGrpcMetadata,
   handleGrpcError,
   RetryPolicyRegistry,
   SERVICE_NAMES,
   withGrpcRetry,
   type JwtPayload,
} from '@common';
import {
   ANALYZE_V1_GRPC_CLIENT,
   ANALYZE_V1_GRPC_SERVICE_NAME,
   type GetUserInterestsResponseDto,
   type IAnalyzeGrpcService,
   type IGetUserInterestsRequest,
   type IRecordWatchSessionRequest,
   type RecordWatchSessionDto,
   type RecordWatchSessionResponseDto,
} from '@contracts/analyze';

export interface AnalyzeCallOptions {
   correlationId?: string;
}

@Injectable()
export class AnalyzeService implements OnModuleInit {
   private analyzeGrpcService!: IAnalyzeGrpcService;
   private readonly analyzeGrpcBreaker = CircuitBreakerRegistry.getOrCreate(ANALYZE_V1_GRPC_SERVICE_NAME, {
      timeout: 5000,
      failureThreshold: 5,
      resetTimeout: 10000,
   });
   private readonly analyzeGrpcRetryPolicy = RetryPolicyRegistry.getOrCreate(ANALYZE_V1_GRPC_SERVICE_NAME, {
      maxAttempts: 3,
      initialDelayMs: 100,
      multiplier: 2,
      maxDelayMs: 2000,
   });

   constructor(@Inject(ANALYZE_V1_GRPC_CLIENT) private readonly analyzeGrpcClient: ClientGrpc) {}

   onModuleInit(): void {
      this.analyzeGrpcService = this.analyzeGrpcClient.getService<IAnalyzeGrpcService>(ANALYZE_V1_GRPC_SERVICE_NAME);
   }

   async recordWatchSession(
      dto: RecordWatchSessionDto,
      user: JwtPayload,
      options?: AnalyzeCallOptions,
   ): Promise<RecordWatchSessionResponseDto> {
      try {
         const metadata = createGrpcMetadata({
            correlationId: options?.correlationId,
            callerService: SERVICE_NAMES.GATEWAY,
            userId: user.sub,
            accountId: user.sub,
            email: user.email,
            roles: user.roles,
         });

         return await this.analyzeGrpcBreaker.execute(async () => {
            const request: IRecordWatchSessionRequest = {
               sessionId: dto.sessionId,
               userId: user.sub,
               videoId: dto.videoId,
               watchDurationMs: dto.watchDurationMs,
               videoDurationMs: dto.videoDurationMs,
               isCompleted: dto.isCompleted ?? false,
               loopCount: dto.loopCount ?? 0,
               categoryIds: dto.categoryIds ?? [],
               tagIds: dto.tagIds ?? [],
               intervals: dto.intervals ?? [],
            };

            const res = await firstValueFrom(
               defer(() => this.analyzeGrpcService.recordWatchSession(request, metadata)).pipe(
                  withGrpcRetry(this.analyzeGrpcRetryPolicy),
               ),
            );

            return {
               success: res.success,
               message: res.message,
               calculatedScoreDelta: res.calculatedScoreDelta,
            };
         });
      } catch (error: unknown) {
         return handleGrpcError(error);
      }
   }

   async getUserInterests(
      userId: string,
      limit = 5,
      options?: AnalyzeCallOptions,
   ): Promise<GetUserInterestsResponseDto> {
      try {
         const metadata = createGrpcMetadata({
            correlationId: options?.correlationId,
            callerService: SERVICE_NAMES.GATEWAY,
            userId,
            accountId: userId,
         });

         return await this.analyzeGrpcBreaker.execute(async () => {
            const request: IGetUserInterestsRequest = {
               userId,
               limit,
            };

            const res = await firstValueFrom(
               defer(() => this.analyzeGrpcService.getUserInterests(request, metadata)).pipe(
                  withGrpcRetry(this.analyzeGrpcRetryPolicy),
               ),
            );

            return {
               userId: res.userId,
               topCategories: res.topCategories || [],
               seenVideoIds: res.seenVideoIds || [],
            };
         });
      } catch (error: unknown) {
         return handleGrpcError(error);
      }
   }
}
