import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@auth/prisma/prisma.service';
import { SessionRepository } from '@auth/repositories/session.repository';

describe('SessionRepository', () => {
   let repository: SessionRepository;

   const sampleSession = {
      sessionId: 'session-id-1',
      accountId: 'user-id-1',
      refreshTokenJti: 'jti-1',
      deviceType: 'desktop',
      deviceName: 'Chrome on macOS',
      browser: 'Chrome 122.0',
      os: 'macOS 14.3',
      userAgent: 'Mozilla/5.0...',
      ipAddress: '127.0.0.1',
      city: 'Ho Chi Minh City',
      region: 'SG',
      country: 'Vietnam',
      countryCode: 'VN',
      deviceId: 'dev-1',
      clientType: 'web',
      appVersion: '1.0.0',
      isRevoked: false,
      lastActiveAt: new Date('2026-09-28T00:00:00.000Z'),
      expiresAt: new Date('2026-10-05T00:00:00.000Z'),
      createdAt: new Date('2026-09-28T00:00:00.000Z'),
      updatedAt: new Date('2026-09-28T00:00:00.000Z'),
   };

   const mockAccountSessionCreate = jest.fn();
   const mockAccountSessionFindUnique = jest.fn();
   const mockAccountSessionFindFirst = jest.fn();
   const mockAccountSessionFindMany = jest.fn();
   const mockAccountSessionUpdate = jest.fn();
   const mockAccountSessionUpdateMany = jest.fn();
   const mockAccountSessionDelete = jest.fn();

   const mockPrismaService = {
      accountSession: {
         create: mockAccountSessionCreate,
         findUnique: mockAccountSessionFindUnique,
         findFirst: mockAccountSessionFindFirst,
         findMany: mockAccountSessionFindMany,
         update: mockAccountSessionUpdate,
         updateMany: mockAccountSessionUpdateMany,
         delete: mockAccountSessionDelete,
      },
   };

   beforeEach(async () => {
      jest.clearAllMocks();

      const module: TestingModule = await Test.createTestingModule({
         providers: [
            SessionRepository,
            {
               provide: PrismaService,
               useValue: mockPrismaService,
            },
         ],
      }).compile();

      repository = module.get<SessionRepository>(SessionRepository);
   });

   it('should create a new session entity', async () => {
      mockAccountSessionCreate.mockResolvedValue(sampleSession);

      const result = await repository.createSession({
         accountId: 'user-id-1',
         refreshTokenJti: 'jti-1',
         deviceType: 'desktop',
         deviceName: 'Chrome on macOS',
         expiresAt: '2026-10-05T00:00:00.000Z',
      });

      expect(result.sessionId).toBe('session-id-1');
      expect(result.accountId).toBe('user-id-1');
      expect(mockAccountSessionCreate).toHaveBeenCalled();
   });

   it('should find session by ID', async () => {
      mockAccountSessionFindUnique.mockResolvedValue(sampleSession);

      const result = await repository.findById('session-id-1');

      expect(result?.sessionId).toBe('session-id-1');
      expect(mockAccountSessionFindUnique).toHaveBeenCalledWith({
         where: { sessionId: 'session-id-1' },
      });
   });

   it('should find active sessions by accountId', async () => {
      mockAccountSessionFindMany.mockResolvedValue([sampleSession]);

      const result = await repository.findActiveSessionsByAccountId('user-id-1');

      expect(result).toHaveLength(1);
      expect(result[0].sessionId).toBe('session-id-1');
      expect(mockAccountSessionFindMany).toHaveBeenCalledTimes(1);
      const findArgs = mockAccountSessionFindMany.mock.calls[0] as [
         { where?: { accountId?: string; isRevoked?: boolean } },
      ];
      expect(findArgs[0]?.where?.accountId).toBe('user-id-1');
      expect(findArgs[0]?.where?.isRevoked).toBe(false);
   });

   it('should revoke a session by id and accountId', async () => {
      mockAccountSessionFindFirst.mockResolvedValue(sampleSession);
      mockAccountSessionUpdate.mockResolvedValue({ ...sampleSession, isRevoked: true });

      const result = await repository.revokeSession('session-id-1', 'user-id-1');

      expect(result?.isRevoked).toBe(true);
      expect(mockAccountSessionUpdate).toHaveBeenCalledWith({
         where: { sessionId: 'session-id-1' },
         data: { isRevoked: true },
      });
   });

   it('should revoke all other sessions and return revoked JTIs', async () => {
      mockAccountSessionFindMany.mockResolvedValue([
         { refreshTokenJti: 'jti-other-1' },
         { refreshTokenJti: 'jti-other-2' },
      ]);
      mockAccountSessionUpdateMany.mockResolvedValue({ count: 2 });

      const jtis = await repository.revokeOtherSessions('user-id-1', 'current-jti');

      expect(jtis).toEqual(['jti-other-1', 'jti-other-2']);
      expect(mockAccountSessionUpdateMany).toHaveBeenCalledWith({
         where: {
            accountId: 'user-id-1',
            refreshTokenJti: { not: 'current-jti' },
            isRevoked: false,
         },
         data: { isRevoked: true },
      });
   });

   it('should revoke all sessions for a user', async () => {
      mockAccountSessionFindMany.mockResolvedValue([{ refreshTokenJti: 'jti-1' }]);
      mockAccountSessionUpdateMany.mockResolvedValue({ count: 1 });

      const jtis = await repository.revokeAllSessions('user-id-1');

      expect(jtis).toEqual(['jti-1']);
      expect(mockAccountSessionUpdateMany).toHaveBeenCalledWith({
         where: {
            accountId: 'user-id-1',
            isRevoked: false,
         },
         data: { isRevoked: true },
      });
   });
});
