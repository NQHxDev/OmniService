import { Controller, Get, HttpCode, HttpStatus, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
   ApiErrorResponses,
   COMMON_ERROR_CODES,
   CurrentUser,
   DEFAULT_ROLES,
   type JwtPayload,
   RequireRoles,
   ResponseMessage,
} from '@common';
import {
   AUDIT_LOG_RESPONSE_MESSAGES,
   AuditLogResponseDto,
   IAuditLogListResult,
   ISecurityAuditLog,
   QueryAuditLogDto,
} from '@contracts/auth';
import { AuditLogsService } from '@/modules/audit-logs/audit-logs.service';

@ApiTags('Audit Logs')
@Controller('audit-logs')
@ApiCookieAuth()
@ApiBearerAuth()
export class AuditLogsController {
   constructor(private readonly auditLogsService: AuditLogsService) {}

   @Get()
   @RequireRoles(DEFAULT_ROLES.ADMIN)
   @HttpCode(HttpStatus.OK)
   @ApiOperation({
      operationId: 'getAuditLogs',
      summary: 'Query system security audit logs with filters (SOC 2, ISO 27001 compliance - Admin only)',
   })
   @ApiResponse({
      status: 200,
      description: 'Audit logs matching query returned successfully.',
      type: [AuditLogResponseDto],
   })
   @ApiErrorResponses([
      {
         status: HttpStatus.BAD_REQUEST,
         description: 'Invalid query filters or pagination parameters',
         errorCodes: [COMMON_ERROR_CODES.VALIDATION_FAILED, COMMON_ERROR_CODES.INVALID_REQUEST],
      },
      {
         status: HttpStatus.UNAUTHORIZED,
         description: 'Authentication token missing or invalid',
         errorCodes: [COMMON_ERROR_CODES.UNAUTHORIZED],
      },
      {
         status: HttpStatus.FORBIDDEN,
         description: 'Forbidden: Requires ADMIN role and AUDIT_LOGS_READ permission',
         errorCodes: [
            COMMON_ERROR_CODES.FORBIDDEN,
            COMMON_ERROR_CODES.INSUFFICIENT_ROLES,
            COMMON_ERROR_CODES.INSUFFICIENT_PERMISSIONS,
         ],
      },
   ])
   @ResponseMessage(AUDIT_LOG_RESPONSE_MESSAGES.GET_LIST_SUCCESS)
   async getAuditLogs(@Query() query: QueryAuditLogDto, @CurrentUser() user: JwtPayload): Promise<IAuditLogListResult> {
      return this.auditLogsService.getAuditLogs(query, user);
   }

   @Get(':id')
   @RequireRoles(DEFAULT_ROLES.ADMIN)
   @HttpCode(HttpStatus.OK)
   @ApiOperation({
      operationId: 'getAuditLogById',
      summary: 'Get security audit log entry details by ID (Admin only)',
   })
   @ApiParam({
      name: 'id',
      description: 'Audit log UUID',
      type: String,
      example: '550e8400-e29b-41d4-a716-446655440000',
   })
   @ApiResponse({
      status: 200,
      description: 'Audit log details returned.',
      type: AuditLogResponseDto,
   })
   @ApiErrorResponses([
      {
         status: HttpStatus.BAD_REQUEST,
         description: 'Invalid audit log ID format',
         errorCodes: [COMMON_ERROR_CODES.INVALID_REQUEST],
      },
      {
         status: HttpStatus.UNAUTHORIZED,
         description: 'Authentication token missing or invalid',
         errorCodes: [COMMON_ERROR_CODES.UNAUTHORIZED],
      },
      {
         status: HttpStatus.FORBIDDEN,
         description: 'Forbidden: Requires ADMIN role and AUDIT_LOGS_READ permission',
         errorCodes: [
            COMMON_ERROR_CODES.FORBIDDEN,
            COMMON_ERROR_CODES.INSUFFICIENT_ROLES,
            COMMON_ERROR_CODES.INSUFFICIENT_PERMISSIONS,
         ],
      },
      {
         status: HttpStatus.NOT_FOUND,
         description: 'Audit log entry not found',
         errorCodes: [COMMON_ERROR_CODES.RESOURCE_NOT_FOUND],
         exampleParams: { id: '550e8400-e29b-41d4-a716-446655440000' },
      },
   ])
   @ResponseMessage(AUDIT_LOG_RESPONSE_MESSAGES.GET_DETAIL_SUCCESS)
   async getAuditLogById(@Param('id') id: string, @CurrentUser() user: JwtPayload): Promise<ISecurityAuditLog | null> {
      return this.auditLogsService.getAuditLogById(id, user);
   }
}
