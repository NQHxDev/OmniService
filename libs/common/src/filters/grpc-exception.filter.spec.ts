import { status as GrpcStatus } from '@grpc/grpc-js';
import { ArgumentsHost } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { AUTH_ERROR_REASONS, COMMON_ERROR_CODES } from '@common';
import { BadRequestException, UnauthorizedException } from '@common/exceptions';
import { GrpcExceptionFilter } from '@common/filters/grpc-exception.filter';
import { GrpcTraceStorage } from '@common/interceptors/grpc-trace.storage';

describe('GrpcExceptionFilter', () => {
   let filter: GrpcExceptionFilter;

   beforeEach(() => {
      filter = new GrpcExceptionFilter();
   });

   it('should map BadRequestException to INVALID_ARGUMENT gRPC status with error payload', async () => {
      const exception = new BadRequestException(COMMON_ERROR_CODES.INVALID_REQUEST, {
         params: { reason: AUTH_ERROR_REASONS.EMAIL_REQUIRED },
      });

      const obs = filter.catch(exception);
      try {
         await firstValueFrom(obs);
         throw new Error('Expected exception to be thrown');
      } catch (err: unknown) {
         expect(err).toBeInstanceOf(RpcException);
         const rpcErr = err as RpcException;
         const error = rpcErr.getError() as { code: number; message: string };
         expect(error.code).toBe(GrpcStatus.INVALID_ARGUMENT);
         const parsed = JSON.parse(error.message) as {
            errorCode: string;
            params?: { reason?: string };
            correlationId?: string;
         };
         expect(parsed.errorCode).toBe(COMMON_ERROR_CODES.INVALID_REQUEST);
         expect(parsed.params?.reason).toBe(AUTH_ERROR_REASONS.EMAIL_REQUIRED);
         expect(parsed.correlationId).toBeDefined();
      }
   });

   it('should preserve active correlationId from GrpcTraceStorage', async () => {
      const exception = new BadRequestException(COMMON_ERROR_CODES.RESOURCE_NOT_FOUND);
      const testTrace = {
         correlationId: 'active-als-corr-id',
         metadata: {},
      };

      await GrpcTraceStorage.run(testTrace, async () => {
         const obs = filter.catch(exception);
         try {
            await firstValueFrom(obs);
            throw new Error('Expected exception to be thrown');
         } catch (err: unknown) {
            const rpcErr = err as RpcException;
            const error = rpcErr.getError() as { code: number; message: string };
            const parsed = JSON.parse(error.message) as {
               errorCode: string;
               correlationId?: string;
            };
            expect(parsed.correlationId).toBe('active-als-corr-id');
         }
      });
   });

   it('should extract correlationId from ArgumentsHost if ALS is empty', async () => {
      const exception = new BadRequestException(COMMON_ERROR_CODES.VALIDATION_FAILED);
      const mockHost = {
         getType: jest.fn().mockReturnValue('rpc'),
         switchToRpc: jest.fn().mockReturnValue({
            getContext: jest.fn().mockReturnValue({
               'x-correlation-id': 'host-corr-999',
            }),
         }),
      } as unknown as ArgumentsHost;

      const obs = filter.catch(exception, mockHost);
      try {
         await firstValueFrom(obs);
         throw new Error('Expected exception to be thrown');
      } catch (err: unknown) {
         const rpcErr = err as RpcException;
         const error = rpcErr.getError() as { code: number; message: string };
         const parsed = JSON.parse(error.message) as {
            errorCode: string;
            correlationId?: string;
         };
         expect(parsed.correlationId).toBe('host-corr-999');
      }
   });

   it('should handle generic Error with INTERNAL gRPC status', async () => {
      const exception = new Error('Database connection failed');

      const obs = filter.catch(exception);
      try {
         await firstValueFrom(obs);
         throw new Error('Expected exception to be thrown');
      } catch (err: unknown) {
         expect(err).toBeInstanceOf(RpcException);
         const rpcErr = err as RpcException;
         const error = rpcErr.getError() as { code: number; message: string };
         expect(error.code).toBe(GrpcStatus.INTERNAL);
      }
   });

   it('should map UnauthorizedException to UNAUTHENTICATED gRPC status with statusCode 401 and details', async () => {
      const exception = new UnauthorizedException(COMMON_ERROR_CODES.UNAUTHORIZED, {
         params: { reason: AUTH_ERROR_REASONS.TOKEN_INVALID_OR_EXPIRED },
      });

      const obs = filter.catch(exception);
      try {
         await firstValueFrom(obs);
         throw new Error('Expected exception to be thrown');
      } catch (err: unknown) {
         expect(err).toBeInstanceOf(RpcException);
         const rpcErr = err as RpcException;
         expect((rpcErr as unknown as { code: number }).code).toBe(GrpcStatus.UNAUTHENTICATED);
         const error = rpcErr.getError() as { code: number; message: string };
         expect(error.code).toBe(GrpcStatus.UNAUTHENTICATED);
         const parsed = JSON.parse(error.message) as {
            statusCode: number;
            errorCode: string;
            params?: { reason?: string };
            correlationId?: string;
         };
         expect(parsed.statusCode).toBe(401);
         expect(parsed.errorCode).toBe(COMMON_ERROR_CODES.UNAUTHORIZED);
         expect(parsed.params?.reason).toBe(AUTH_ERROR_REASONS.TOKEN_INVALID_OR_EXPIRED);
         expect((rpcErr as unknown as { details: string }).details).toBeDefined();
      }
   });

   it('should map RpcException with gRPC code to appropriate HTTP statusCode and preserve errorCode', async () => {
      const exception = new RpcException({
         code: GrpcStatus.INVALID_ARGUMENT,
         message: 'ORDER.INVALID_STATUS_TRANSITION',
      });

      const obs = filter.catch(exception);
      try {
         await firstValueFrom(obs);
         throw new Error('Expected exception to be thrown');
      } catch (err: unknown) {
         expect(err).toBeInstanceOf(RpcException);
         const rpcErr = err as RpcException;
         const error = rpcErr.getError() as { code: number; message: string };
         expect(error.code).toBe(GrpcStatus.INVALID_ARGUMENT);
         const parsed = JSON.parse(error.message) as {
            statusCode: number;
            errorCode: string;
            message: string;
         };
         expect(parsed.statusCode).toBe(400);
         expect(parsed.errorCode).toBe('ORDER.INVALID_STATUS_TRANSITION');
         expect(parsed.message).toBe('ORDER.INVALID_STATUS_TRANSITION');
      }
   });
});
