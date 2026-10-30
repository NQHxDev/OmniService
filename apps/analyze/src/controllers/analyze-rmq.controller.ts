import { Controller, UsePipes, ValidationPipe } from '@nestjs/common';
import { EventPattern, MessagePattern, Payload } from '@nestjs/microservices';
import { ANALYZE_EVENTS, ANALYZE_PATTERNS, GetUserInterestsDto, RecordWatchSessionDto } from '@contracts/analyze';
import { AnalyzeService } from '@analyze/services/analyze.service';

@Controller()
export class AnalyzeRmqController {
   constructor(private readonly analyzeService: AnalyzeService) {}

   @EventPattern(ANALYZE_EVENTS.VIDEO_WATCHED)
   @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
   async handleVideoWatchedEvent(@Payload() payload: RecordWatchSessionDto): Promise<void> {
      await this.analyzeService.recordWatchSession(payload);
   }

   @MessagePattern(ANALYZE_PATTERNS.RECORD_SESSION)
   @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
   async recordSession(@Payload() payload: RecordWatchSessionDto) {
      return this.analyzeService.recordWatchSession(payload);
   }

   @MessagePattern(ANALYZE_PATTERNS.GET_INTERESTS)
   @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
   async getUserInterests(@Payload() payload: GetUserInterestsDto) {
      return this.analyzeService.getUserInterests(payload);
   }
}
