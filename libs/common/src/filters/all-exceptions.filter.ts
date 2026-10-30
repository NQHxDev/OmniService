import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { COMMON_ERROR_CODES } from '@common/exceptions/error-codes';
import { IErrorResponse, IValidationErrorDetail } from '@common/interfaces/response.interface';
import { CORRELATION_ID_HEADER, REQUEST_ID_HEADER } from '@common/logger/logger.constants';
import { mapGrpcStatusToHttpStatus } from '@common/interceptors/grpc-interceptor.util';

interface ExceptionResponseObject {
   message?: string | string[] | Record<string, unknown>;
   error?: string;
   statusCode?: number;
   errorCode?: string;
   params?: Record<string, unknown>;
   details?: unknown;
   errors?: IValidationErrorDetail[];
}

interface LoggableRequest extends Request {
   action?: string;
   customLogMessage?: string;
   userId?: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
   private readonly logger = new Logger(AllExceptionsFilter.name);

   catch(exception: unknown, host: ArgumentsHost) {
      const ctx = host.switchToHttp();
      const response = ctx.getResponse<Response>();
      const request = ctx.getRequest<LoggableRequest>();

      let status: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR;
      let errorCode: string = COMMON_ERROR_CODES.INTERNAL_SERVER_ERROR;
      let message: string = COMMON_ERROR_CODES.INTERNAL_SERVER_ERROR;
      let error = 'Internal Server Error';
      let params: Record<string, unknown> | undefined = undefined;
      let details: unknown = undefined;
      let validationErrors: IValidationErrorDetail[] | undefined = undefined;

      if (exception instanceof HttpException) {
         status = exception.getStatus();
         const res = exception.getResponse();

         if (typeof res === 'object' && res !== null) {
            const resObj = res as ExceptionResponseObject;
            error = resObj.error || this.getHttpStatusText(status);
            errorCode =
               resObj.errorCode ||
               (typeof resObj.message === 'string' && resObj.message !== '[object Object]'
                  ? resObj.message
                  : this.getDefaultErrorCode(status));
            params = resObj.params;
            details = resObj.details;

            if (Array.isArray(resObj.message)) {
               errorCode = COMMON_ERROR_CODES.VALIDATION_FAILED;
               message = COMMON_ERROR_CODES.VALIDATION_FAILED;
               validationErrors = resObj.message.map((msg) => {
                  if (typeof msg === 'string') {
                     const field = msg.split(' ')[0] || 'field';
                     return { field, message: msg };
                  }
                  return msg;
               });
            } else if (typeof resObj.message === 'string' && resObj.message !== '[object Object]') {
               message = resObj.message;
            } else {
               message = errorCode;
            }

            if (resObj.errors && Array.isArray(resObj.errors)) {
               validationErrors = resObj.errors;
            }
         } else if (typeof res === 'string') {
            errorCode = res === '[object Object]' ? this.getDefaultErrorCode(status) : res;
            message = errorCode;
            error = this.getHttpStatusText(status);
         }
      } else if (typeof exception === 'string') {
         try {
            const parsed = JSON.parse(exception) as Record<string, unknown>;
            if (typeof parsed === 'object' && parsed !== null && (parsed.statusCode || parsed.errorCode)) {
               status = (parsed.statusCode as number) || HttpStatus.BAD_REQUEST;
               errorCode =
                  (parsed.errorCode as string) ||
                  (typeof parsed.message === 'string' && parsed.message !== '[object Object]'
                     ? parsed.message
                     : COMMON_ERROR_CODES.INVALID_REQUEST);
               message =
                  (typeof parsed.message === 'string' && parsed.message !== '[object Object]'
                     ? parsed.message
                     : errorCode) || errorCode;
               error = (parsed.error as string) || this.getHttpStatusText(status);
               params = parsed.params as Record<string, unknown> | undefined;
               details = parsed.details;
               validationErrors = parsed.errors as IValidationErrorDetail[] | undefined;
            } else {
               errorCode = exception === '[object Object]' ? COMMON_ERROR_CODES.INTERNAL_SERVER_ERROR : exception;
               message = errorCode;
               error = this.getHttpStatusText(status);
            }
         } catch {
            errorCode = exception === '[object Object]' ? COMMON_ERROR_CODES.INTERNAL_SERVER_ERROR : exception;
            message = errorCode;
            error = this.getHttpStatusText(status);
         }
      } else if (this.isRpcOrCustomErrorObject(exception)) {
         const rpcObj = this.extractRpcErrorObject(exception);
         status = (rpcObj.statusCode as HttpStatus) || HttpStatus.BAD_REQUEST;
         errorCode =
            rpcObj.errorCode ||
            (typeof rpcObj.message === 'string' && rpcObj.message !== '[object Object]'
               ? rpcObj.message
               : COMMON_ERROR_CODES.INVALID_REQUEST);
         message =
            (typeof rpcObj.message === 'string' && rpcObj.message !== '[object Object]' ? rpcObj.message : errorCode) ||
            errorCode;
         error = rpcObj.error || this.getHttpStatusText(status);
         params = rpcObj.params;
         details = rpcObj.details;
         validationErrors = rpcObj.errors;
      } else if (exception instanceof Error) {
         const expAny = exception as unknown as Record<string, unknown>;
         const nestedObj =
            typeof expAny.response === 'object' && expAny.response !== null
               ? (expAny.response as Record<string, unknown>)
               : typeof expAny.error === 'object' && expAny.error !== null
                 ? (expAny.error as Record<string, unknown>)
                 : typeof expAny.cause === 'object' && expAny.cause !== null
                   ? (expAny.cause as Record<string, unknown>)
                   : null;

         if (nestedObj && this.isRpcOrCustomErrorObject(nestedObj)) {
            const rpcObj = this.extractRpcErrorObject(nestedObj);
            status = (rpcObj.statusCode as HttpStatus) || HttpStatus.BAD_REQUEST;
            errorCode =
               rpcObj.errorCode ||
               (typeof rpcObj.message === 'string' && rpcObj.message !== '[object Object]'
                  ? rpcObj.message
                  : COMMON_ERROR_CODES.INVALID_REQUEST);
            message =
               (typeof rpcObj.message === 'string' && rpcObj.message !== '[object Object]'
                  ? rpcObj.message
                  : errorCode) || errorCode;
            error = rpcObj.error || this.getHttpStatusText(status);
            params = rpcObj.params;
            details = rpcObj.details;
            validationErrors = rpcObj.errors;
         } else {
            let parsed: Record<string, unknown> | null = null;
            const rawMsg = exception.message || '';
            const rawDetails = typeof expAny.details === 'string' ? expAny.details : '';

            if (rawDetails) {
               try {
                  parsed = JSON.parse(rawDetails) as Record<string, unknown>;
               } catch {
                  // ignore
               }
            }

            if (!parsed && rawMsg) {
               try {
                  parsed = JSON.parse(rawMsg) as Record<string, unknown>;
               } catch {
                  const start = rawMsg.indexOf('{');
                  const end = rawMsg.lastIndexOf('}');
                  if (start !== -1 && end > start) {
                     try {
                        parsed = JSON.parse(rawMsg.slice(start, end + 1)) as Record<string, unknown>;
                     } catch {
                        // ignore
                     }
                  }
               }
            }

            if (parsed && typeof parsed === 'object') {
               if (typeof parsed.message === 'string' && parsed.message.startsWith('{')) {
                  try {
                     const inner = JSON.parse(parsed.message) as Record<string, unknown>;
                     parsed = { ...inner, ...parsed };
                  } catch {
                     // ignore
                  }
               }

               if (parsed.statusCode || parsed.errorCode) {
                  const grpcNumCode = typeof expAny.code === 'number' ? expAny.code : undefined;
                  status =
                     (parsed.statusCode as number) ||
                     (grpcNumCode ? mapGrpcStatusToHttpStatus(grpcNumCode) : HttpStatus.BAD_REQUEST);
                  errorCode =
                     (parsed.errorCode as string) ||
                     (typeof parsed.message === 'string' && parsed.message !== '[object Object]'
                        ? parsed.message
                        : this.getDefaultErrorCode(status));
                  message =
                     (typeof parsed.message === 'string' && parsed.message !== '[object Object]'
                        ? parsed.message
                        : errorCode) || errorCode;
                  error = (parsed.error as string) || this.getHttpStatusText(status);
                  params = parsed.params as Record<string, unknown> | undefined;
                  details = parsed.details;
                  validationErrors = parsed.errors as IValidationErrorDetail[] | undefined;
               } else {
                  message =
                     exception.message === '[object Object]'
                        ? COMMON_ERROR_CODES.INTERNAL_SERVER_ERROR
                        : exception.message;
                  error = exception.name || 'Internal Server Error';
               }
            } else {
               message =
                  exception.message === '[object Object]'
                     ? COMMON_ERROR_CODES.INTERNAL_SERVER_ERROR
                     : exception.message;
               error = exception.name || 'Internal Server Error';
            }
         }
      }

      // Final sanity check to never return "[object Object]"
      if (typeof message !== 'string' || message === '[object Object]' || message.includes('[object Object]')) {
         message = errorCode || COMMON_ERROR_CODES.INTERNAL_SERVER_ERROR;
      }

      const formattedValidationErrors =
         validationErrors && validationErrors.length > 0
            ? validationErrors.map((e) => (e.field ? `${e.field}: ${e.message}` : e.message)).join('; ')
            : undefined;

      if (request) {
         request.customLogMessage = formattedValidationErrors ? `${message} (${formattedValidationErrors})` : message;
         if (errorCode && !request.action) {
            request.action = errorCode;
         }
      }

      const correlationId =
         (request?.headers?.[CORRELATION_ID_HEADER] as string) ||
         (request?.headers?.[REQUEST_ID_HEADER] as string) ||
         (request?.id as string);

      const errorResponse: IErrorResponse = {
         success: false,
         statusCode: status,
         message,
         error,
         errorCode,
         ...(params ? { params } : {}),
         ...(details !== undefined ? { details } : {}),
         ...(validationErrors && validationErrors.length > 0 ? { errors: validationErrors } : {}),
         path: request?.url || '',
         method: request?.method || '',
         timestamp: new Date().toISOString(),
         ...(correlationId ? { correlationId } : {}),
      };

      const logSuffix = formattedValidationErrors ? ` - ValidationErrors: [${formattedValidationErrors}]` : '';

      if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
         this.logger.error(
            `[${request?.method || 'UNKNOWN'}] ${request?.url || ''} - Status: ${status} - ErrorCode: ${errorCode} - Message: ${message}${logSuffix}`,
            exception instanceof Error ? exception.stack : undefined,
         );
      } else {
         this.logger.warn(
            `[${request?.method || 'UNKNOWN'}] ${request?.url || ''} - Status: ${status} - ErrorCode: ${errorCode} - Message: ${message}${logSuffix}`,
         );
      }

      response.status(status).json(errorResponse);
   }

   private isRpcOrCustomErrorObject(exception: unknown): boolean {
      if (typeof exception !== 'object' || exception === null) {
         return false;
      }
      const obj = exception as Record<string, unknown>;
      return (
         'statusCode' in obj ||
         'errorCode' in obj ||
         ('error' in obj && typeof (obj as { error?: unknown }).error === 'object')
      );
   }

   private extractRpcErrorObject(exception: unknown): ExceptionResponseObject {
      const obj = exception as Record<string, unknown>;
      if (obj.error && typeof obj.error === 'object') {
         return obj.error;
      }
      return obj;
   }

   private getDefaultErrorCode(status: HttpStatus): string {
      switch (status) {
         case HttpStatus.BAD_REQUEST:
            return COMMON_ERROR_CODES.INVALID_REQUEST;
         case HttpStatus.UNAUTHORIZED:
            return COMMON_ERROR_CODES.UNAUTHORIZED;
         case HttpStatus.FORBIDDEN:
            return COMMON_ERROR_CODES.FORBIDDEN;
         case HttpStatus.NOT_FOUND:
            return COMMON_ERROR_CODES.RESOURCE_NOT_FOUND;
         case HttpStatus.CONFLICT:
            return COMMON_ERROR_CODES.CONFLICT;
         case HttpStatus.REQUEST_TIMEOUT:
            return COMMON_ERROR_CODES.TIMEOUT;
         case HttpStatus.UNPROCESSABLE_ENTITY:
            return COMMON_ERROR_CODES.VALIDATION_FAILED;
         case HttpStatus.TOO_MANY_REQUESTS:
            return COMMON_ERROR_CODES.TOO_MANY_REQUESTS;
         case HttpStatus.SERVICE_UNAVAILABLE:
            return COMMON_ERROR_CODES.SERVICE_UNAVAILABLE;
         default:
            return COMMON_ERROR_CODES.INTERNAL_SERVER_ERROR;
      }
   }

   private getHttpStatusText(status: HttpStatus): string {
      switch (status) {
         case HttpStatus.BAD_REQUEST:
            return 'Bad Request';
         case HttpStatus.UNAUTHORIZED:
            return 'Unauthorized';
         case HttpStatus.FORBIDDEN:
            return 'Forbidden';
         case HttpStatus.NOT_FOUND:
            return 'Not Found';
         case HttpStatus.CONFLICT:
            return 'Conflict';
         case HttpStatus.REQUEST_TIMEOUT:
            return 'Request Timeout';
         case HttpStatus.UNPROCESSABLE_ENTITY:
            return 'Unprocessable Entity';
         case HttpStatus.TOO_MANY_REQUESTS:
            return 'Too Many Requests';
         case HttpStatus.SERVICE_UNAVAILABLE:
            return 'Service Unavailable';
         default:
            return 'Internal Server Error';
      }
   }
}
