import { Test, TestingModule } from '@nestjs/testing';
import type { ClientGrpc } from '@nestjs/microservices';
import type { Metadata } from '@grpc/grpc-js';
import { of, throwError } from 'rxjs';
import { DEFAULT_ROLES, type JwtPayload } from '@common';
import {
   ANALYZE_V1_GRPC_CLIENT,
   type IAnalyzeGrpcService,
   type IGetUserInterestsResponse,
   type IRecordWatchSessionResponse,
   type RecordWatchSessionDto,
} from '@contracts/analyze';
import { AnalyzeService } from '@/modules/analyze/analyze.service';

describe('AnalyzeService', () => {
   let service: AnalyzeService;
   let mockAnalyzeGrpcService: jest.Mocked<IAnalyzeGrpcService>;

   beforeEach(async () => {
      mockAnalyzeGrpcService = {
         recordWatchSession: jest.fn(),
         getUserInterests: jest.fn(),
      };

      const mockClientGrpc: jest.Mocked<ClientGrpc> = {
         getService: jest.fn().mockReturnValue(mockAnalyzeGrpcService),
         getClientByServiceName: jest.fn(),
      };

      const module: TestingModule = await Test.createTestingModule({
         providers: [AnalyzeService, { provide: ANALYZE_V1_GRPC_CLIENT, useValue: mockClientGrpc }],
      }).compile();

      service = module.get<AnalyzeService>(AnalyzeService);
      service.onModuleInit();
   });

   it('should be defined', () => {
      expect(service).toBeDefined();
   });

   describe('recordWatchSession', () => {
      it('should inject caller user context and correlationId into gRPC metadata', async () => {
         const expectedResponse: IRecordWatchSessionResponse = {
            success: true,
            message: 'ANALYZE.RECORD_SESSION_SUCCESS',
            calculatedScoreDelta: 3,
         };

         let capturedMetadata: Metadata | undefined;
         mockAnalyzeGrpcService.recordWatchSession.mockImplementation((_req, metadata) => {
            capturedMetadata = metadata as Metadata;
            return of(expectedResponse);
         });

         const dto: RecordWatchSessionDto = {
            sessionId: '0192e21b-0002-7000-8000-000000000001',
            videoId: '0192e21b-0003-7000-8000-000000000002',
            watchDurationMs: 45000,
            videoDurationMs: 50000,
            isCompleted: true,
            loopCount: 0,
            categoryIds: ['vietnamese-food'],
            tagIds: ['phobo'],
         };

         const user: JwtPayload = {
            sub: 'user-uuid-1',
            email: 'user@example.com',
            roles: [DEFAULT_ROLES.USER],
         };

         const result = await service.recordWatchSession(dto, user, { correlationId: 'corr-analyze-1' });

         expect(result).toEqual(expectedResponse);
         expect(mockAnalyzeGrpcService.recordWatchSession).toHaveBeenCalledWith(
            expect.objectContaining({
               userId: 'user-uuid-1',
               videoId: '0192e21b-0003-7000-8000-000000000002',
               watchDurationMs: 45000,
               videoDurationMs: 50000,
               isCompleted: true,
            }),
            expect.anything(),
         );

         expect(capturedMetadata).toBeDefined();
         expect(capturedMetadata?.get('x-user-id')?.[0]).toBe('user-uuid-1');
         expect(capturedMetadata?.get('x-correlation-id')?.[0]).toBe('corr-analyze-1');
      });

      it('should handle gRPC errors gracefully through handleGrpcError', async () => {
         const grpcError = Object.assign(
            new Error('3 INVALID_ARGUMENT: {"statusCode":400,"errorCode":"ANALYZE.INVALID_SESSION_DATA"}'),
            {
               code: 3,
               details: JSON.stringify({
                  statusCode: 400,
                  errorCode: 'ANALYZE.INVALID_SESSION_DATA',
               }),
            },
         );

         mockAnalyzeGrpcService.recordWatchSession.mockImplementation(() => throwError(() => grpcError));

         const dto: RecordWatchSessionDto = {
            videoId: 'invalid-vid',
            watchDurationMs: 0,
            videoDurationMs: 0,
         };

         const user: JwtPayload = {
            sub: 'user-1',
            email: 'user1@example.com',
         };

         await expect(service.recordWatchSession(dto, user)).rejects.toThrow();
      });
   });

   describe('getUserInterests', () => {
      it('should call gRPC getUserInterests and return categories and seen videos', async () => {
         const expectedResponse: IGetUserInterestsResponse = {
            userId: 'user-uuid-1',
            topCategories: [{ categoryId: 'cat-1', score: 10.5 }],
            seenVideoIds: ['vid-1', 'vid-2'],
         };

         mockAnalyzeGrpcService.getUserInterests.mockImplementation(() => of(expectedResponse));

         const result = await service.getUserInterests('user-uuid-1', 5, { correlationId: 'corr-2' });

         expect(result).toEqual(expectedResponse);
         expect(mockAnalyzeGrpcService.getUserInterests).toHaveBeenCalledWith(
            { userId: 'user-uuid-1', limit: 5 },
            expect.anything(),
         );
      });
   });
});
