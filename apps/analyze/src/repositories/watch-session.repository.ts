import { Injectable } from '@nestjs/common';
import { PrismaService } from '@analyze/prisma/prisma.service';

export interface CreateWatchSessionRecordParams {
   sessionId?: string;
   userId: string;
   videoId: string;
   watchDurationMs: number;
   videoDurationMs: number;
   completionRate: number;
   isCompleted: boolean;
   loopCount: number;
   calculatedScore: number;
   categoryIds: string[];
   tagIds: string[];
}

@Injectable()
export class WatchSessionRepository {
   constructor(private readonly prisma: PrismaService) {}

   async create(params: CreateWatchSessionRecordParams) {
      return this.prisma.watchSession.create({
         data: {
            ...(params.sessionId ? { sessionId: params.sessionId } : {}),
            userId: params.userId,
            videoId: params.videoId,
            watchDurationMs: params.watchDurationMs,
            videoDurationMs: params.videoDurationMs,
            completionRate: params.completionRate,
            isCompleted: params.isCompleted,
            loopCount: params.loopCount,
            calculatedScore: params.calculatedScore,
            categoryIds: params.categoryIds,
            tagIds: params.tagIds,
         },
      });
   }

   async findRecentSessionsByUserId(userId: string, limit = 20) {
      return this.prisma.watchSession.findMany({
         where: { userId },
         orderBy: { createdAt: 'desc' },
         take: limit,
      });
   }
}
