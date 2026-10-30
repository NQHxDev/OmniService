import { status as GrpcStatus } from '@grpc/grpc-js';
import { HttpStatus } from '@nestjs/common';
import { AppException } from '@common/exceptions/app.exception';
import {
   BadRequestException,
   ConflictException,
   ForbiddenException,
   InternalServerException,
   NotFoundException,
   ServiceUnavailableException,
   TimeoutException,
   TooManyRequestsException,
   UnauthorizedException,
} from '@common/exceptions/http.exceptions';
import { COMMON_ERROR_CODES } from '@common/exceptions/error-codes';

export { GrpcStatus };

export const GRPC_STATUS_KEYWORDS = {
   UNAVAILABLE: 'UNAVAILABLE',
   DEADLINE_EXCEEDED: 'DEADLINE_EXCEEDED',
} as const;

export type GrpcStatusKeyword = (typeof GRPC_STATUS_KEYWORDS)[keyof typeof GRPC_STATUS_KEYWORDS];

export interface IGrpcSerializedError {
   errorCode?: string;
   message?: string;
   statusCode?: HttpStatus;
   params?: Record<string, unknown>;
   correlationId?: string;
}

/**
 * Universal error handler for gRPC client responses across Gateway and Microservices.
 * Maps incoming gRPC exceptions back into appropriate domain AppException subclasses,
 * preserving i18n translation keys (errorCode) and interpolation parameters (params).
 */
export const handleGrpcError = (error: unknown): never => {
   if (error instanceof AppException) {
      throw error;
   }

   if (typeof error === 'object' && error !== null) {
      const errObj = error as { message?: unknown; code?: number; details?: unknown };
      const grpcCode = errObj.code;
      const rawMessage = typeof errObj.message === 'string' ? errObj.message : '';
      const rawDetails = typeof errObj.details === 'string' ? errObj.details : '';

      let parsed: IGrpcSerializedError | null = null;

      // Try parsing rawDetails first (contains the pure details string from gRPC server)
      if (rawDetails) {
         try {
            parsed = JSON.parse(rawDetails) as IGrpcSerializedError;
         } catch {
            // rawDetails might not be JSON
         }
      }

      // Try parsing rawMessage directly
      if (!parsed && rawMessage) {
         try {
            parsed = JSON.parse(rawMessage) as IGrpcSerializedError;
         } catch {
            // rawMessage may be prefixed with "<code number> <STATUS>: "
         }
      }

      // Try extracting JSON {...} substring from rawMessage
      if (!parsed && rawMessage) {
         const start = rawMessage.indexOf('{');
         const end = rawMessage.lastIndexOf('}');
         if (start !== -1 && end > start) {
            try {
               parsed = JSON.parse(rawMessage.slice(start, end + 1)) as IGrpcSerializedError;
            } catch {
               // ignore
            }
         }
      }

      // If parsed has a nested message that is itself JSON, unpack it
      if (parsed && typeof parsed === 'object') {
         if (typeof parsed.message === 'string' && parsed.message.startsWith('{')) {
            try {
               const nested = JSON.parse(parsed.message) as IGrpcSerializedError;
               parsed = { ...nested, ...parsed };
               if (nested.statusCode && !parsed.statusCode) {
                  parsed.statusCode = nested.statusCode;
               }
            } catch {
               // ignore
            }
         }

         const errorCode = parsed.errorCode || COMMON_ERROR_CODES.INVALID_REQUEST;
         const params = parsed.params;
         const statusCode = parsed.statusCode;

         if (statusCode) {
            switch (statusCode) {
               case HttpStatus.BAD_REQUEST:
               case HttpStatus.UNPROCESSABLE_ENTITY:
                  throw new BadRequestException(errorCode, { params });
               case HttpStatus.UNAUTHORIZED:
                  throw new UnauthorizedException(errorCode, { params });
               case HttpStatus.FORBIDDEN:
                  throw new ForbiddenException(errorCode, { params });
               case HttpStatus.NOT_FOUND:
                  throw new NotFoundException(errorCode, { params });
               case HttpStatus.CONFLICT:
                  throw new ConflictException(errorCode, { params });
               case HttpStatus.TOO_MANY_REQUESTS:
                  throw new TooManyRequestsException(errorCode, { params });
               case HttpStatus.REQUEST_TIMEOUT:
                  throw new TimeoutException(errorCode, { params });
               case HttpStatus.SERVICE_UNAVAILABLE:
                  throw new ServiceUnavailableException(errorCode, { params });
               default: {
                  const numericStatus = Number(statusCode);
                  if (numericStatus >= 400 && numericStatus < 500) {
                     throw new BadRequestException(errorCode, { params });
                  }
                  throw new InternalServerException(errorCode, { params });
               }
            }
         }

         // Fallback mapping by gRPC status code constant
         switch (grpcCode) {
            case GrpcStatus.INVALID_ARGUMENT:
            case GrpcStatus.FAILED_PRECONDITION:
            case GrpcStatus.OUT_OF_RANGE:
               throw new BadRequestException(errorCode, { params });
            case GrpcStatus.NOT_FOUND:
               throw new NotFoundException(errorCode, { params });
            case GrpcStatus.ALREADY_EXISTS:
               throw new ConflictException(errorCode, { params });
            case GrpcStatus.PERMISSION_DENIED:
               throw new ForbiddenException(errorCode, { params });
            case GrpcStatus.RESOURCE_EXHAUSTED:
               throw new TooManyRequestsException(errorCode, { params });
            case GrpcStatus.UNAUTHENTICATED:
               throw new UnauthorizedException(errorCode, { params });
            case GrpcStatus.DEADLINE_EXCEEDED:
               throw new TimeoutException(errorCode || COMMON_ERROR_CODES.TIMEOUT, { params });
            case GrpcStatus.UNAVAILABLE:
               throw new ServiceUnavailableException(errorCode || COMMON_ERROR_CODES.SERVICE_UNAVAILABLE, {
                  params,
               });
            default:
               switch (errorCode) {
                  case COMMON_ERROR_CODES.UNAUTHORIZED:
                  case COMMON_ERROR_CODES.MISSING_USER_CONTEXT:
                     throw new UnauthorizedException(errorCode, { params });
                  case COMMON_ERROR_CODES.FORBIDDEN:
                  case COMMON_ERROR_CODES.INSUFFICIENT_ROLES:
                  case COMMON_ERROR_CODES.INSUFFICIENT_PERMISSIONS:
                  case COMMON_ERROR_CODES.NOT_RESOURCE_OWNER:
                  case COMMON_ERROR_CODES.NOT_OWNER_OR_ADMIN:
                     throw new ForbiddenException(errorCode, { params });
                  case COMMON_ERROR_CODES.RESOURCE_NOT_FOUND:
                     throw new NotFoundException(errorCode, { params });
                  case COMMON_ERROR_CODES.CONFLICT:
                     throw new ConflictException(errorCode, { params });
                  default:
                     throw new BadRequestException(errorCode, { params });
               }
         }
      }

      // Check unparsed raw gRPC errors (e.g. connection refused, network timeout)
      if (grpcCode === GrpcStatus.UNAVAILABLE || rawMessage.includes(GRPC_STATUS_KEYWORDS.UNAVAILABLE)) {
         throw new ServiceUnavailableException(COMMON_ERROR_CODES.SERVICE_UNAVAILABLE, {
            params: { details: rawMessage },
         });
      }
      if (grpcCode === GrpcStatus.DEADLINE_EXCEEDED || rawMessage.includes(GRPC_STATUS_KEYWORDS.DEADLINE_EXCEEDED)) {
         throw new TimeoutException(COMMON_ERROR_CODES.TIMEOUT, {
            params: { details: rawMessage },
         });
      }
      if (grpcCode === GrpcStatus.UNAUTHENTICATED) {
         throw new UnauthorizedException(COMMON_ERROR_CODES.UNAUTHORIZED, {
            params: { details: rawMessage },
         });
      }
   }

   throw error;
};
