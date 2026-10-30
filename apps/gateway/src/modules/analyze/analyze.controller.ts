import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ApiBearerAuth, ApiCookieAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
   ApiErrorResponses,
   COMMON_ERROR_CODES,
   CORRELATION_ID_HEADER,
   CurrentUser,
   type JwtPayload,
   ResponseMessage,
} from '@common';
import {
   ANALYZE_ERROR_CODES,
   ANALYZE_RESPONSE_MESSAGES,
   GetUserInterestsQueryDto,
   GetUserInterestsResponseDto,
   RecordWatchSessionDto,
   RecordWatchSessionResponseDto,
} from '@contracts/analyze';
import { AnalyzeService } from '@/modules/analyze/analyze.service';

@ApiTags('Analyze')
@Controller('analyze')
@ApiBearerAuth()
@ApiCookieAuth()
export class AnalyzeController {
   constructor(private readonly analyzeService: AnalyzeService) {}

   @Post('watch-session')
   @HttpCode(HttpStatus.CREATED)
   @ApiOperation({
      operationId: 'recordWatchSession',
      summary: 'Record video watch session and update behavioral affinities',
      description: `### Workflow: Video Watch Session Analytics Recording
#### Prerequisites
- Authenticated user session.
- Valid \`videoId\` representing the content being watched.

#### Process Flow
- Accepts video playback telemetry including \`watchDurationMs\`, \`videoDurationMs\`, completion status, loops, and optional timeline \`intervals\`.
- Evaluates interaction quality using unique content coverage via interval merging:
  - Fast skips (< 3s or < 15% unique coverage) yield negative feedback (-1).
  - Normal engagement (30% - 70%) grants positive feedback (+1).
  - High retention (>= 85% coverage or completed status) grants maximum base feedback (+3).
  - In-depth content dynamically scales with a logarithmic duration coefficient.
  - Replay loops contribute capped bonus points (+2 per loop, max 3 loops) to prevent bot farming.
- Persists session event to PostgreSQL for audit and cold analysis.
- Immediately updates real-time category affinities in Redis (ZSET) and marks video as seen (TTL 3 days).

#### Next Step
- Call \`GET /api/v1/analyze/interests\` to fetch updated top categories and recommendation seeds.`,
   })
   @ApiResponse({
      status: HttpStatus.CREATED,
      description: 'Watch session recorded and behavior score calculated successfully.',
      type: RecordWatchSessionResponseDto,
      links: {
         GetUserInterests: {
            operationId: 'getUserInterests',
            description:
               'Fetch updated content interest affinities and seen video history after recording watch session',
         },
      },
   })
   @ApiErrorResponses([
      {
         status: HttpStatus.BAD_REQUEST,
         description: 'Invalid watch session telemetry payload or non-positive video duration',
         errorCodes: [ANALYZE_ERROR_CODES.INVALID_SESSION_DATA, COMMON_ERROR_CODES.INVALID_REQUEST],
      },
      {
         status: HttpStatus.UNAUTHORIZED,
         description: 'User authentication required',
         errorCodes: [COMMON_ERROR_CODES.UNAUTHORIZED],
      },
   ])
   @ResponseMessage(ANALYZE_RESPONSE_MESSAGES.RECORD_SESSION_SUCCESS)
   async recordWatchSession(
      @Body() dto: RecordWatchSessionDto,
      @CurrentUser() user: JwtPayload,
      @Req() req: Request,
   ): Promise<RecordWatchSessionResponseDto> {
      const correlationId = req.headers[CORRELATION_ID_HEADER] as string | undefined;
      return this.analyzeService.recordWatchSession(dto, user, { correlationId });
   }

   @Get('interests')
   @HttpCode(HttpStatus.OK)
   @ApiOperation({
      operationId: 'getUserInterests',
      summary: 'Get personalized category affinities and seen videos for current user',
      description: `### Workflow: User Content Affinity & Recommendation Retrieval
#### Prerequisites
- Authenticated user session.

#### Process Flow
- Retrieves the user's top interest categories ordered by accumulated affinity score from Redis ZSET.
- Fetches recent seen video identifiers to prevent repetitive feed recommendations.

#### Next Step
- Pass top category identifiers to \`GET /api/v1/posts/feed\` or search recommendations to tailor feed content.`,
   })
   @ApiResponse({
      status: HttpStatus.OK,
      description: 'Personalized user interests and seen video IDs retrieved successfully.',
      type: GetUserInterestsResponseDto,
   })
   @ApiErrorResponses([
      {
         status: HttpStatus.BAD_REQUEST,
         description: 'Invalid query parameters or limit out of bounds',
         errorCodes: [COMMON_ERROR_CODES.INVALID_REQUEST],
      },
      {
         status: HttpStatus.UNAUTHORIZED,
         description: 'User authentication required',
         errorCodes: [COMMON_ERROR_CODES.UNAUTHORIZED],
      },
   ])
   @ResponseMessage(ANALYZE_RESPONSE_MESSAGES.GET_INTERESTS_SUCCESS)
   async getUserInterests(
      @Query() query: GetUserInterestsQueryDto,
      @CurrentUser() user: JwtPayload,
      @Req() req: Request,
   ): Promise<GetUserInterestsResponseDto> {
      const correlationId = req.headers[CORRELATION_ID_HEADER] as string | undefined;
      return this.analyzeService.getUserInterests(user.sub, query.limit, { correlationId });
   }

   @Get('users/:userId/interests')
   @HttpCode(HttpStatus.OK)
   @ApiOperation({
      operationId: 'getUserInterestsByUserId',
      summary: 'Get personalized category affinities for a specific user ID',
      description: 'Retrieves top behavioral category interests and seen video history for a designated user UUID.',
   })
   @ApiParam({
      name: 'userId',
      description: 'Unique UUID identifier of the target user',
      example: '0192e21b-0001-7000-8000-000000000001',
   })
   @ApiResponse({
      status: HttpStatus.OK,
      description: 'User interests retrieved successfully.',
      type: GetUserInterestsResponseDto,
   })
   @ApiErrorResponses([
      {
         status: HttpStatus.BAD_REQUEST,
         description: 'Invalid user UUID format or query parameters',
         errorCodes: [COMMON_ERROR_CODES.INVALID_REQUEST],
      },
      {
         status: HttpStatus.UNAUTHORIZED,
         description: 'User authentication required',
         errorCodes: [COMMON_ERROR_CODES.UNAUTHORIZED],
      },
      {
         status: HttpStatus.NOT_FOUND,
         description: 'User profile or interest history not found',
         errorCodes: [ANALYZE_ERROR_CODES.USER_NOT_FOUND],
      },
   ])
   @ResponseMessage(ANALYZE_RESPONSE_MESSAGES.GET_INTERESTS_SUCCESS)
   async getUserInterestsByUserId(
      @Param('userId') userId: string,
      @Query() query: GetUserInterestsQueryDto,
      @Req() req: Request,
   ): Promise<GetUserInterestsResponseDto> {
      const correlationId = req.headers[CORRELATION_ID_HEADER] as string | undefined;
      return this.analyzeService.getUserInterests(userId, query.limit, { correlationId });
   }
}
