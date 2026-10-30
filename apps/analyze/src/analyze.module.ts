import { Module } from '@nestjs/common';
import { GrpcHealthModule, RedisModule, RmqModule } from '@common';
import { AnalyzeConfigModule } from '@analyze/config';
import { AnalyzeLoggerModule } from '@analyze/logger';
import { PrismaModule } from '@analyze/prisma/prisma.module';
import { WatchSessionRepository } from '@analyze/repositories/watch-session.repository';
import { ScoringStrategy } from '@analyze/services/scoring.strategy';
import { AnalyzeCacheService } from '@analyze/services/analyze-cache.service';
import { AnalyzeService } from '@analyze/services/analyze.service';
import { AnalyzeRmqController } from '@analyze/controllers/analyze-rmq.controller';
import { AnalyzeGrpcController } from '@analyze/controllers/analyze-grpc.controller';

@Module({
   imports: [AnalyzeConfigModule, AnalyzeLoggerModule, RmqModule, RedisModule, PrismaModule, GrpcHealthModule],
   controllers: [AnalyzeRmqController, AnalyzeGrpcController],
   providers: [WatchSessionRepository, ScoringStrategy, AnalyzeCacheService, AnalyzeService],
   exports: [AnalyzeService, AnalyzeCacheService],
})
export class AnalyzeModule {}
