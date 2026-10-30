import { ArgumentsHost, Catch, HttpException, HttpStatus, Logger, type RpcExceptionFilter } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { status as GrpcStatus } from '@grpc/grpc-js';
import { Observable, throwError } from 'rxjs';
import { AppException, COMMON_ERROR_CODES } from '@common';
import {
   extractGrpcMetadata,
   mapGrpcStatusToHttpStatus,
   mapHttpStatusToGrpc,
} from '@common/interceptors/grpc-interceptor.util';
import { GrpcTraceStorage } from '@common/interceptors/grpc-trace.storage';
import { uuidv7 } from '@common/utils/uuid.util';

/**
 * Universal Filter for catching and mapping domain & application exceptions into standard gRPC status codes.
 * Ensures metadata, tracing correlation ID, and i18n error codes are preserved for gRPC clients.
 */
@Catch()
export class GrpcExceptionFilter implements RpcExceptionFilter {
   private readonly logger = new Logger(GrpcExceptionFilter.name);

   catch(exception: unknown, host?: ArgumentsHost): Observable<never> {
      let code: number = GrpcStatus.INTERNAL;
      let statusCode: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR;
      let errorCode: string = COMMON_ERROR_CODES.INTERNAL_SERVER_ERROR;
      let message: string = COMMON_ERROR_CODES.INTERNAL_SERVER_ERROR;
      let params: Record<string, unknown> | undefined = undefined;

      // Extract correlation ID from AsyncLocalStorage or host context
      let correlationId = GrpcTraceStorage.getCorrelationId();
      if (!correlationId && host) {
         try {
            const extracted = extractGrpcMetadata(host);
            correlationId = extracted.correlationId;
         } catch {
            // Ignore if context extraction is unavailable
         }
      }
      if (!correlationId) {
         correlationId = uuidv7();
      }

      if (exception instanceof AppException) {
         const payload = exception.getPayload();
         statusCode = payload.statusCode;
         code = this.mapHttpStatusToGrpc(payload.statusCode);
         errorCode = payload.errorCode;
         message = payload.message || payload.errorCode;
         params = payload.params;
      } else if (exception instanceof HttpException) {
         statusCode = exception.getStatus();
         code = this.mapHttpStatusToGrpc(statusCode);
         const res = exception.getResponse();
         if (typeof res === 'object' && res !== null) {
            const resObj = res as Record<string, unknown>;
            errorCode =
               (resObj.errorCode as string) ||
               (typeof resObj.message === 'string' && resObj.message !== '[object Object]'
                  ? resObj.message
                  : COMMON_ERROR_CODES.INVALID_REQUEST);
            message =
               typeof resObj.message === 'string' && resObj.message !== '[object Object]' ? resObj.message : errorCode;
            params = resObj.params as Record<string, unknown> | undefined;
         } else if (typeof res === 'string') {
            errorCode = res;
            message = res;
         }
      } else if (exception instanceof RpcException) {
         const error = exception.getError();
         if (typeof error === 'object' && error !== null) {
            const errObj = error as Record<string, unknown>;
            if (typeof errObj.statusCode === 'number') {
               statusCode = errObj.statusCode;
               code = this.mapHttpStatusToGrpc(statusCode);
            }
            if (typeof errObj.code === 'number') {
               code = errObj.code;
               if (typeof errObj.statusCode !== 'number') {
                  statusCode = mapGrpcStatusToHttpStatus(code);
               }
            }
            if (typeof errObj.errorCode === 'string') {
               errorCode = errObj.errorCode;
            } else if (typeof errObj.message === 'string') {
               errorCode = errObj.message;
            }
            if (typeof errObj.message === 'string') {
               message = errObj.message;
            } else if (typeof errObj.errorCode === 'string') {
               message = errObj.errorCode;
            }
            if (typeof errObj.params === 'object' && errObj.params !== null) {
               params = errObj.params as Record<string, unknown>;
            }
            if (typeof errObj.correlationId === 'string') {
               correlationId = errObj.correlationId;
            }
         } else if (typeof error === 'string') {
            try {
               const parsed = JSON.parse(error) as Record<string, unknown>;
               if (typeof parsed.statusCode === 'number') {
                  statusCode = parsed.statusCode;
                  code = this.mapHttpStatusToGrpc(statusCode);
               }
               if (typeof parsed.code === 'number') {
                  code = parsed.code;
                  if (typeof parsed.statusCode !== 'number') {
                     statusCode = mapGrpcStatusToHttpStatus(code);
                  }
               }
               if (typeof parsed.errorCode === 'string') {
                  errorCode = parsed.errorCode;
               } else if (typeof parsed.message === 'string') {
                  errorCode = parsed.message;
               }
               if (typeof parsed.message === 'string') {
                  message = parsed.message;
               } else if (typeof parsed.errorCode === 'string') {
                  message = parsed.errorCode;
               }
               if (typeof parsed.params === 'object' && parsed.params !== null) {
                  params = parsed.params as Record<string, unknown>;
               }
            } catch {
               message = error;
               errorCode = error;
            }
         }
      } else if (exception instanceof Error) {
         const expAny = exception as unknown as Record<string, unknown>;
         if (typeof expAny.statusCode === 'number') {
            statusCode = expAny.statusCode;
            code = this.mapHttpStatusToGrpc(statusCode);
         } else if (typeof expAny.status === 'number') {
            statusCode = expAny.status;
            code = this.mapHttpStatusToGrpc(statusCode);
         }

         try {
            const parsed = JSON.parse(exception.message) as Record<string, unknown>;
            if (typeof parsed.statusCode === 'number') {
               statusCode = parsed.statusCode;
               code = this.mapHttpStatusToGrpc(statusCode);
            }
            if (typeof parsed.errorCode === 'string') {
               errorCode = parsed.errorCode;
            }
            if (typeof parsed.message === 'string') {
               message = parsed.message;
            }
            if (typeof parsed.params === 'object' && parsed.params !== null) {
               params = parsed.params as Record<string, unknown>;
            }
         } catch {
            message = exception.message;
         }
      }

      const serializedPayload = JSON.stringify({
         statusCode,
         errorCode,
         message,
         params,
         correlationId,
      });

      this.logger.warn(`gRPC Exception: [${correlationId}] [code=${code}] [status=${statusCode}] ${errorCode}`);

      const rpcError = new RpcException({
         code,
         message: serializedPayload,
      });
      Object.assign(rpcError, {
         code,
         details: serializedPayload,
         message: serializedPayload,
      });

      return throwError(() => rpcError);
   }

   protected mapHttpStatusToGrpc(httpStatus: HttpStatus): number {
      return mapHttpStatusToGrpc(httpStatus);
   }
}
