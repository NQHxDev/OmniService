import { ArgumentsHost, BadRequestException as NestBadRequestException, HttpStatus } from '@nestjs/common';
import { BadRequestException } from '@common/exceptions';
import { COMMON_ERROR_CODES } from '@common/exceptions/error-codes';
import { AllExceptionsFilter } from '@common/filters/all-exceptions.filter';

describe('AllExceptionsFilter', () => {
   let filter: AllExceptionsFilter;
   let mockJson: jest.Mock;
   let mockStatus: jest.Mock;
   let mockHost: ArgumentsHost;
   let mockRequest: Record<string, unknown>;

   beforeEach(() => {
      filter = new AllExceptionsFilter();
      mockJson = jest.fn();
      mockStatus = jest.fn().mockReturnValue({ json: mockJson });
      mockRequest = {
         url: '/api/v1/test',
         method: 'POST',
         headers: { 'x-correlation-id': 'corr-123' },
      };

      mockHost = {
         switchToHttp: () => ({
            getResponse: () => ({
               status: mockStatus,
            }),
            getRequest: () => mockRequest,
         }),
      } as unknown as ArgumentsHost;
   });

   it('should handle custom AppException properly', () => {
      const exception = new BadRequestException('AUTH.INVALID_CREDENTIALS', {
         params: { attemptsLeft: 3 },
      });

      filter.catch(exception, mockHost);

      expect(mockStatus).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(mockJson).toHaveBeenCalledWith(
         expect.objectContaining({
            success: false,
            statusCode: 400,
            errorCode: 'AUTH.INVALID_CREDENTIALS',
            message: 'AUTH.INVALID_CREDENTIALS',
            params: { attemptsLeft: 3 },
            path: '/api/v1/test',
            method: 'POST',
            correlationId: 'corr-123',
         }),
      );
   });

   it('should handle RPC serialized error object with statusCode and errorCode', () => {
      const rpcError = {
         statusCode: 404,
         errorCode: 'AUTH.USER_NOT_FOUND',
         message: 'AUTH.USER_NOT_FOUND',
         params: { id: 'u1' },
      };

      filter.catch(rpcError, mockHost);

      expect(mockStatus).toHaveBeenCalledWith(404);
      expect(mockJson).toHaveBeenCalledWith(
         expect.objectContaining({
            success: false,
            statusCode: 404,
            errorCode: 'AUTH.USER_NOT_FOUND',
            message: 'AUTH.USER_NOT_FOUND',
            params: { id: 'u1' },
         }),
      );
   });

   it('should handle serialized JSON string Error from RabbitMQ microservice client', () => {
      const rpcJsonError = new Error(
         JSON.stringify({
            statusCode: 401,
            errorCode: 'AUTH.INVALID_CREDENTIALS',
            message: 'AUTH.INVALID_CREDENTIALS',
         }),
      );

      filter.catch(rpcJsonError, mockHost);

      expect(mockStatus).toHaveBeenCalledWith(401);
      expect(mockJson).toHaveBeenCalledWith(
         expect.objectContaining({
            success: false,
            statusCode: 401,
            errorCode: 'AUTH.INVALID_CREDENTIALS',
            message: 'AUTH.INVALID_CREDENTIALS',
            error: 'Unauthorized',
         }),
      );
   });

   it('should handle raw JSON string from RPC client', () => {
      const rpcJsonString = JSON.stringify({
         statusCode: 401,
         errorCode: 'AUTH.INVALID_CREDENTIALS',
         message: 'AUTH.INVALID_CREDENTIALS',
      });

      filter.catch(rpcJsonString, mockHost);

      expect(mockStatus).toHaveBeenCalledWith(401);
      expect(mockJson).toHaveBeenCalledWith(
         expect.objectContaining({
            success: false,
            statusCode: 401,
            errorCode: 'AUTH.INVALID_CREDENTIALS',
            message: 'AUTH.INVALID_CREDENTIALS',
            error: 'Unauthorized',
         }),
      );
   });

   it('should handle raw error code string', () => {
      filter.catch('AUTH.INVALID_CREDENTIALS', mockHost);

      expect(mockStatus).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(mockJson).toHaveBeenCalledWith(
         expect.objectContaining({
            success: false,
            statusCode: 500,
            errorCode: 'AUTH.INVALID_CREDENTIALS',
            message: 'AUTH.INVALID_CREDENTIALS',
         }),
      );
   });

   it('should sanitize and prevent [object Object] message leak on malformed Error', () => {
      const exception = new Error('[object Object]');

      filter.catch(exception, mockHost);

      expect(mockStatus).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(mockJson).toHaveBeenCalledWith(
         expect.objectContaining({
            success: false,
            statusCode: 500,
            errorCode: COMMON_ERROR_CODES.INTERNAL_SERVER_ERROR,
            message: COMMON_ERROR_CODES.INTERNAL_SERVER_ERROR,
         }),
      );
   });

   it('should extract error from nested object inside Error instance', () => {
      const exception = new Error('RPC Exception');
      (exception as unknown as Record<string, unknown>).error = {
         statusCode: 403,
         errorCode: 'AUTH.FORBIDDEN',
         message: 'AUTH.FORBIDDEN',
      };

      filter.catch(exception, mockHost);

      expect(mockStatus).toHaveBeenCalledWith(403);
      expect(mockJson).toHaveBeenCalledWith(
         expect.objectContaining({
            success: false,
            statusCode: 403,
            errorCode: 'AUTH.FORBIDDEN',
            message: 'AUTH.FORBIDDEN',
         }),
      );
   });

   it('should handle ValidationPipe errors and format validationErrors properly', () => {
      const nestValidationException = new NestBadRequestException([
         'mediaId must be a UUID',
         'duration must not be less than 0',
      ]);

      filter.catch(nestValidationException, mockHost);

      expect(mockStatus).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(mockJson).toHaveBeenCalledWith(
         expect.objectContaining({
            success: false,
            statusCode: 400,
            errorCode: COMMON_ERROR_CODES.VALIDATION_FAILED,
            message: COMMON_ERROR_CODES.VALIDATION_FAILED,
            errors: [
               { field: 'mediaId', message: 'mediaId must be a UUID' },
               { field: 'duration', message: 'duration must not be less than 0' },
            ],
         }),
      );
      expect(mockRequest.customLogMessage).toContain('mediaId: mediaId must be a UUID');
   });

   it('should fallback to 500 INTERNAL_SERVER_ERROR for standard unhandled errors', () => {
      const exception = new Error('Database connection failed');

      filter.catch(exception, mockHost);

      expect(mockStatus).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(mockJson).toHaveBeenCalledWith(
         expect.objectContaining({
            success: false,
            statusCode: 500,
            errorCode: COMMON_ERROR_CODES.INTERNAL_SERVER_ERROR,
            message: 'Database connection failed',
         }),
      );
   });
});
