import { EventEmitter2 } from '@nestjs/event-emitter';
import { SYSTEM_ROLES, type IDeviceInfo } from '@common';
import { USER_STATUS } from '@contracts/auth';
import type { AccountEntity } from '@auth/entities';
import type { AuditLogService, ITokenLifecycleService } from '@auth/services/infrastructure';
import { AbstractAuthFlow } from '@auth/templates/abstract-auth.flow';
import type { AuthFlowContext, AuthProvisionResult, IAuthSaga } from '@auth/templates/auth-flow.interface';

interface TestDto {
   email: string;
   password?: string;
   ip?: string;
}

class TestAuthFlow extends AbstractAuthFlow<TestDto, IAuthSaga> {
   public authenticateOrProvisionMock = jest.fn();
   public onSuccessMock = jest.fn();
   public emitSuccessEventMock = jest.fn();
   public emitFailureEventMock = jest.fn();
   public getAuditActionMock = jest.fn().mockReturnValue('TEST.AUTH_SUCCESS');

   protected authenticateOrProvision(dto: TestDto, deviceInfo?: IDeviceInfo): Promise<AuthProvisionResult<IAuthSaga>> {
      return this.authenticateOrProvisionMock(dto, deviceInfo);
   }

   protected onSuccess(context: AuthFlowContext<TestDto, IAuthSaga>): Promise<void> {
      return this.onSuccessMock(context);
   }

   protected emitSuccessEvent(context: AuthFlowContext<TestDto, IAuthSaga>): void {
      this.emitSuccessEventMock(context);
   }

   protected emitFailureEvent(error: unknown, dto: TestDto, deviceInfo?: IDeviceInfo, clientIp?: string): void {
      this.emitFailureEventMock(error, dto, deviceInfo, clientIp);
   }

   protected getAuditAction(): string {
      return this.getAuditActionMock();
   }
}

describe('AbstractAuthFlow (Template Method Pattern)', () => {
   let flow: TestAuthFlow;
   let mockTokenLifecycleService: jest.Mocked<ITokenLifecycleService>;
   let mockAuditLogService: jest.Mocked<AuditLogService>;
   let mockEventEmitter: jest.Mocked<EventEmitter2>;
   let mockSaga: jest.Mocked<IAuthSaga>;

   const mockAccount: AccountEntity = {
      accountId: 'acc-123',
      email: 'test@example.com',
      passwordHash: '$argon2id$mockedpasswordhash',
      roles: [SYSTEM_ROLES.USER],
      status: USER_STATUS.ACTIVE,
      isEmailVerified: true,
      lastLoginAt: '2026-10-01T00:00:00.000Z',
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
   };

   beforeEach(() => {
      jest.clearAllMocks();

      mockTokenLifecycleService = {
         generateTokenPair: jest.fn().mockResolvedValue({
            accessToken: 'mock-access-token',
            refreshToken: 'mock-refresh-token',
         }),
      } as unknown as jest.Mocked<ITokenLifecycleService>;

      mockAuditLogService = {
         record: jest.fn().mockResolvedValue(undefined),
      } as unknown as jest.Mocked<AuditLogService>;

      mockEventEmitter = {
         emit: jest.fn(),
      } as unknown as jest.Mocked<EventEmitter2>;

      mockSaga = {
         setTokens: jest.fn(),
         rollback: jest.fn().mockResolvedValue(undefined),
      };

      flow = new TestAuthFlow(mockTokenLifecycleService, mockAuditLogService, mockEventEmitter);
   });

   it('should execute the invariant template sequence successfully', async () => {
      flow.authenticateOrProvisionMock.mockResolvedValue({
         account: mockAccount,
         saga: mockSaga,
         clientIp: '127.0.0.1',
         lastLoginAt: '2026-10-15T00:00:00.000Z',
      });
      flow.onSuccessMock.mockResolvedValue(undefined);

      const dto: TestDto = { email: 'test@example.com' };
      const deviceInfo: IDeviceInfo = { ipAddress: '127.0.0.1', userAgent: 'Jest' };

      const result = await flow.execute(dto, deviceInfo);

      // Step 1: Provision
      expect(flow.authenticateOrProvisionMock).toHaveBeenCalledWith(dto, deviceInfo);
      // Step 2 & 3: Token generation & saga registration
      expect(mockTokenLifecycleService.generateTokenPair).toHaveBeenCalledWith(
         { accountId: 'acc-123', email: 'test@example.com', roles: [SYSTEM_ROLES.USER] },
         deviceInfo,
      );
      expect(mockSaga.setTokens).toHaveBeenCalledWith({
         accessToken: 'mock-access-token',
         refreshToken: 'mock-refresh-token',
      });
      // Step 4: onSuccess
      expect(flow.onSuccessMock).toHaveBeenCalledWith(
         expect.objectContaining({
            account: mockAccount,
            clientIp: '127.0.0.1',
            lastLoginAt: '2026-10-15T00:00:00.000Z',
         }),
      );
      // Step 5: Audit log
      expect(mockAuditLogService.record).toHaveBeenCalled();
      // Step 6: Success event
      expect(flow.emitSuccessEventMock).toHaveBeenCalled();
      // Step 7: IAuthResult structure
      expect(result).toEqual({
         user: {
            userId: 'acc-123',
            email: 'test@example.com',
            roles: [SYSTEM_ROLES.USER],
            status: USER_STATUS.ACTIVE,
            isEmailVerified: true,
            lastLoginAt: '2026-10-15T00:00:00.000Z',
            createdAt: '2026-09-01T00:00:00.000Z',
            updatedAt: '2026-10-01T00:00:00.000Z',
         },
         accessToken: 'mock-access-token',
         refreshToken: 'mock-refresh-token',
      });
      expect(mockSaga.rollback).not.toHaveBeenCalled();
   });

   it('should rollback saga, emit failure event, and rethrow if token generation fails', async () => {
      flow.authenticateOrProvisionMock.mockResolvedValue({
         account: mockAccount,
         saga: mockSaga,
         clientIp: '127.0.0.1',
      });
      const tokenError = new Error('JWT Signer unavailable');
      mockTokenLifecycleService.generateTokenPair.mockRejectedValue(tokenError);

      const dto: TestDto = { email: 'test@example.com' };

      await expect(flow.execute(dto)).rejects.toThrow('JWT Signer unavailable');

      expect(mockSaga.rollback).toHaveBeenCalledTimes(1);
      expect(flow.emitFailureEventMock).toHaveBeenCalledWith(tokenError, dto, undefined, '127.0.0.1');
      expect(flow.onSuccessMock).not.toHaveBeenCalled();
   });

   it('should rollback saga, emit failure event, and rethrow if onSuccess fails', async () => {
      flow.authenticateOrProvisionMock.mockResolvedValue({
         account: mockAccount,
         saga: mockSaga,
         clientIp: '127.0.0.1',
      });
      const dbError = new Error('Database connection failed');
      flow.onSuccessMock.mockRejectedValue(dbError);

      const dto: TestDto = { email: 'test@example.com' };

      await expect(flow.execute(dto)).rejects.toThrow('Database connection failed');

      expect(mockSaga.rollback).toHaveBeenCalledTimes(1);
      expect(flow.emitFailureEventMock).toHaveBeenCalledWith(dbError, dto, undefined, '127.0.0.1');
   });

   it('should continue gracefully if audit log fails (non-blocking fire-and-forget)', async () => {
      flow.authenticateOrProvisionMock.mockResolvedValue({
         account: mockAccount,
         saga: mockSaga,
      });
      flow.onSuccessMock.mockResolvedValue(undefined);
      mockAuditLogService.record.mockRejectedValue(new Error('Audit DB is read-only'));

      const result = await flow.execute({ email: 'test@example.com' });

      expect(result.accessToken).toBe('mock-access-token');
      expect(mockSaga.rollback).not.toHaveBeenCalled();
   });
});
