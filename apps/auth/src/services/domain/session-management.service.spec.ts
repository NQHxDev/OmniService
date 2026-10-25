import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotFoundException } from '@common';
import { AUDIT_ACTIONS, AUDIT_STATUS } from '@contracts/auth';
import type { IDeviceInfo } from '@common';
import { SESSION_REPOSITORY } from '@auth/repositories';
import { AuditLogService, TOKEN_LIFECYCLE_SERVICE } from '@auth/services/infrastructure';
import type { SessionEntity } from '@auth/entities/session.entity';
import { SessionManagementService } from '@auth/services/domain/session-management.service';

describe('SessionManagementService', () => {
   let service: SessionManagementService;

   const mockSessionRepository = {
      findById: jest.fn(),
      findActiveSessionsByAccountId: jest.fn(),
      revokeSession: jest.fn(),
      revokeOtherSessions: jest.fn(),
   };

   const mockTokenLifecycleService = {
      invalidateRefreshToken: jest.fn(),
      logoutAll: jest.fn(),
   };

   const mockAuditLogService = {
      record: jest.fn().mockResolvedValue(null),
   };

   const sampleSession: SessionEntity = {
      sessionId: 'session-1',
      accountId: 'user-1',
      refreshTokenJti: 'jti-1',
      deviceType: 'desktop',
      deviceName: 'MacBook Pro',
      browser: 'Chrome 120',
      os: 'macOS 14',
      ipAddress: '192.168.1.1',
      city: 'Hanoi',
      region: 'Hanoi',
      country: 'Vietnam',
      countryCode: 'VN',
      userAgent: 'Mozilla/5.0...',
      isRevoked: false,
      lastActiveAt: '2026-10-10T00:00:00.000Z',
      expiresAt: '2026-10-17T00:00:00.000Z',
      createdAt: '2026-10-10T00:00:00.000Z',
      updatedAt: '2026-10-10T00:00:00.000Z',
   };

   beforeEach(async () => {
      jest.clearAllMocks();
      jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
      jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});

      const module: TestingModule = await Test.createTestingModule({
         providers: [
            SessionManagementService,
            {
               provide: SESSION_REPOSITORY,
               useValue: mockSessionRepository,
            },
            {
               provide: TOKEN_LIFECYCLE_SERVICE,
               useValue: mockTokenLifecycleService,
            },
            {
               provide: AuditLogService,
               useValue: mockAuditLogService,
            },
            {
               provide: EventEmitter2,
               useValue: { emit: jest.fn() },
            },
         ],
      }).compile();

      service = module.get<SessionManagementService>(SessionManagementService);
   });

   it('should be defined', () => {
      expect(service).toBeDefined();
   });

   describe('getSessions', () => {
      it('should return active sessions list with isCurrent marked accurately', async () => {
         const session2: SessionEntity = {
            ...sampleSession,
            sessionId: 'session-2',
            refreshTokenJti: 'jti-2',
            deviceName: 'iPhone 15',
         };
         mockSessionRepository.findActiveSessionsByAccountId.mockResolvedValue([sampleSession, session2]);

         const result = await service.getSessions('user-1', 'jti-1');

         expect(result).toHaveLength(2);
         expect(result[0]).toEqual({
            sessionId: 'session-1',
            deviceType: 'desktop',
            deviceName: 'MacBook Pro',
            browser: 'Chrome 120',
            os: 'macOS 14',
            ipAddress: '192.168.1.1',
            city: 'Hanoi',
            region: 'Hanoi',
            country: 'Vietnam',
            countryCode: 'VN',
            userAgent: 'Mozilla/5.0...',
            isCurrent: true,
            lastActiveAt: '2026-10-10T00:00:00.000Z',
            expiresAt: '2026-10-17T00:00:00.000Z',
            createdAt: '2026-10-10T00:00:00.000Z',
         });
         expect(result[1].isCurrent).toBe(false);
         expect(mockSessionRepository.findActiveSessionsByAccountId).toHaveBeenCalledWith('user-1');
      });

      it('should return empty array when no active sessions are found', async () => {
         mockSessionRepository.findActiveSessionsByAccountId.mockResolvedValue([]);

         const result = await service.getSessions('user-1');

         expect(result).toEqual([]);
      });

      it('should handle null return from repository gracefully', async () => {
         mockSessionRepository.findActiveSessionsByAccountId.mockResolvedValue(null);

         const result = await service.getSessions('user-1');

         expect(result).toEqual([]);
      });
   });

   describe('revokeSession', () => {
      const deviceInfo: IDeviceInfo = {
         ipAddress: '192.168.1.100',
         userAgent: 'Mozilla/5.0',
         deviceType: 'desktop',
         deviceName: 'MacBook Pro',
         browser: 'Chrome',
         os: 'macOS',
         city: 'Hanoi',
         country: 'Vietnam',
      };

      it('should revoke a session successfully and record audit log', async () => {
         mockSessionRepository.findById.mockResolvedValue(sampleSession);
         mockSessionRepository.revokeSession.mockResolvedValue(sampleSession);
         mockTokenLifecycleService.invalidateRefreshToken.mockResolvedValue(undefined);

         await service.revokeSession('user-1', 'session-1', deviceInfo);

         expect(mockSessionRepository.findById).toHaveBeenCalledWith('session-1');
         expect(mockSessionRepository.revokeSession).toHaveBeenCalledWith('session-1', 'user-1');
         expect(mockTokenLifecycleService.invalidateRefreshToken).toHaveBeenCalledWith('user-1', 'jti-1');
         expect(mockAuditLogService.record).toHaveBeenCalledWith(
            expect.objectContaining({
               accountId: 'user-1',
               action: AUDIT_ACTIONS.AUTH_SESSION_REVOKE,
               status: AUDIT_STATUS.SUCCESS,
               ipAddress: deviceInfo.ipAddress,
               metadata: {
                  sessionId: 'session-1',
                  deviceType: sampleSession.deviceType,
                  browser: sampleSession.browser,
                  ipAddress: sampleSession.ipAddress,
               },
            }),
         );
      });

      it('should throw NotFoundException if session does not exist', async () => {
         mockSessionRepository.findById.mockResolvedValue(null);

         await expect(service.revokeSession('user-1', 'non-existent')).rejects.toThrow(NotFoundException);
         expect(mockSessionRepository.revokeSession).not.toHaveBeenCalled();
         expect(mockTokenLifecycleService.invalidateRefreshToken).not.toHaveBeenCalled();
      });

      it('should throw NotFoundException if session belongs to a different account', async () => {
         mockSessionRepository.findById.mockResolvedValue({
            ...sampleSession,
            accountId: 'other-user',
         });

         await expect(service.revokeSession('user-1', 'session-1')).rejects.toThrow(NotFoundException);
         expect(mockSessionRepository.revokeSession).not.toHaveBeenCalled();
         expect(mockTokenLifecycleService.invalidateRefreshToken).not.toHaveBeenCalled();
      });

      it('should return idempotently if session is already revoked', async () => {
         mockSessionRepository.findById.mockResolvedValue({
            ...sampleSession,
            isRevoked: true,
         });

         await service.revokeSession('user-1', 'session-1', deviceInfo);

         expect(mockSessionRepository.revokeSession).not.toHaveBeenCalled();
         expect(mockTokenLifecycleService.invalidateRefreshToken).not.toHaveBeenCalled();
         expect(mockAuditLogService.record).not.toHaveBeenCalled();
      });
   });

   describe('revokeOtherSessions', () => {
      const deviceInfo: IDeviceInfo = {
         ipAddress: '10.0.0.1',
         userAgent: 'Firefox',
         deviceType: 'mobile',
         deviceName: 'Pixel',
         browser: 'Firefox',
         os: 'Android',
         city: 'Da Nang',
         country: 'Vietnam',
      };

      it('should return revokedCount 0 if no other sessions exist', async () => {
         mockSessionRepository.findActiveSessionsByAccountId.mockResolvedValue([
            { ...sampleSession, refreshTokenJti: 'current-jti' },
         ]);

         const result = await service.revokeOtherSessions('user-1', 'current-jti', deviceInfo);

         expect(result).toEqual({ revokedCount: 0 });
         expect(mockSessionRepository.revokeOtherSessions).not.toHaveBeenCalled();
         expect(mockTokenLifecycleService.invalidateRefreshToken).not.toHaveBeenCalled();
      });

      it('should revoke all other sessions and invalidate their refresh tokens in parallel', async () => {
         mockSessionRepository.findActiveSessionsByAccountId.mockResolvedValue([
            { ...sampleSession, refreshTokenJti: 'current-jti' },
            { ...sampleSession, sessionId: 'session-2', refreshTokenJti: 'jti-other-1' },
            { ...sampleSession, sessionId: 'session-3', refreshTokenJti: 'jti-other-2' },
         ]);
         mockSessionRepository.revokeOtherSessions.mockResolvedValue(['jti-other-1', 'jti-other-2']);
         mockTokenLifecycleService.invalidateRefreshToken.mockResolvedValue(undefined);

         const result = await service.revokeOtherSessions('user-1', 'current-jti', deviceInfo);

         expect(result).toEqual({ revokedCount: 2 });
         expect(mockSessionRepository.revokeOtherSessions).toHaveBeenCalledWith('user-1', 'current-jti');
         expect(mockTokenLifecycleService.invalidateRefreshToken).toHaveBeenCalledWith('user-1', 'jti-other-1');
         expect(mockTokenLifecycleService.invalidateRefreshToken).toHaveBeenCalledWith('user-1', 'jti-other-2');
         expect(mockAuditLogService.record).toHaveBeenCalledWith(
            expect.objectContaining({
               accountId: 'user-1',
               action: AUDIT_ACTIONS.AUTH_SESSION_REVOKE_OTHERS,
               status: AUDIT_STATUS.SUCCESS,
               metadata: {
                  revokedCount: 2,
                  currentJti: 'current-jti',
               },
            }),
         );
      });

      it('should handle audit log failures gracefully without throwing', async () => {
         mockSessionRepository.findActiveSessionsByAccountId.mockResolvedValue([
            { ...sampleSession, sessionId: 'session-2', refreshTokenJti: 'jti-other-1' },
         ]);
         mockSessionRepository.revokeOtherSessions.mockResolvedValue(['jti-other-1']);
         mockTokenLifecycleService.invalidateRefreshToken.mockResolvedValue(undefined);
         mockAuditLogService.record.mockRejectedValueOnce(new Error('Audit log DB failure'));

         const result = await service.revokeOtherSessions('user-1', 'current-jti');

         expect(result).toEqual({ revokedCount: 1 });
      });
   });

   describe('revokeAllAccountSessions', () => {
      it('should logout all sessions via tokenLifecycleService and record audit log', async () => {
         mockTokenLifecycleService.logoutAll.mockResolvedValue(undefined);

         await service.revokeAllAccountSessions('user-1');

         expect(mockTokenLifecycleService.logoutAll).toHaveBeenCalledWith('user-1');
         expect(mockAuditLogService.record).toHaveBeenCalledWith(
            expect.objectContaining({
               accountId: 'user-1',
               action: AUDIT_ACTIONS.AUTH_SESSION_REVOKE,
               status: AUDIT_STATUS.SUCCESS,
               metadata: { accountId: 'user-1' },
            }),
         );
      });
   });
});
