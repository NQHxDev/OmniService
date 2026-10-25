import { AuditStatus } from '@auth/prisma-client';
import { AuditLogBuilder } from '@auth/builders/audit-log.builder';
import type { IDeviceInfo } from '@common';

describe('AuditLogBuilder', () => {
   const sampleDeviceInfo: IDeviceInfo = {
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      deviceType: 'desktop',
      deviceName: 'MacBook Pro',
      browser: 'Chrome 120.0',
      os: 'macOS 14.0',
      city: 'San Francisco',
      country: 'United States',
   };

   it('should build a successful audit log with default status and required action', () => {
      const data = AuditLogBuilder.create().withAction('AUTH_LOGIN_SUCCESS').build();

      expect(data).toEqual({
         action: 'AUTH_LOGIN_SUCCESS',
         status: AuditStatus.SUCCESS,
         accountId: null,
         actorEmail: null,
         ipAddress: null,
         userAgent: null,
         deviceType: null,
         deviceName: null,
         browser: null,
         os: null,
         city: null,
         country: null,
         reason: null,
         metadata: null,
      });
   });

   it('should throw an error if action is missing when calling build()', () => {
      const builder = AuditLogBuilder.create();
      expect(() => builder.build()).toThrow('AuditLogBuilder: "action" is required to build CreateAuditLogData');
   });

   it('should build failure audit log with reason using asFailure()', () => {
      const data = AuditLogBuilder.create()
         .withAction('AUTH_LOGIN_FAILED')
         .asFailure('INVALID_CREDENTIALS')
         .withActorEmail('user@example.com')
         .build();

      expect(data.status).toBe(AuditStatus.FAILURE);
      expect(data.reason).toBe('INVALID_CREDENTIALS');
      expect(data.actorEmail).toBe('user@example.com');
   });

   it('should map device info fields correctly', () => {
      const data = AuditLogBuilder.create()
         .withAction('AUTH_TOKEN_REFRESH')
         .asSuccess()
         .withDeviceInfo(sampleDeviceInfo)
         .build();

      expect(data.ipAddress).toBe(sampleDeviceInfo.ipAddress);
      expect(data.userAgent).toBe(sampleDeviceInfo.userAgent);
      expect(data.deviceType).toBe(sampleDeviceInfo.deviceType);
      expect(data.deviceName).toBe(sampleDeviceInfo.deviceName);
      expect(data.browser).toBe(sampleDeviceInfo.browser);
      expect(data.os).toBe(sampleDeviceInfo.os);
      expect(data.city).toBe(sampleDeviceInfo.city);
      expect(data.country).toBe(sampleDeviceInfo.country);
   });

   it('should preserve explicit ipAddress over deviceInfo ipAddress', () => {
      const data = AuditLogBuilder.create()
         .withAction('AUTH_REGISTER')
         .withIpAddress('10.0.0.1')
         .withDeviceInfo(sampleDeviceInfo)
         .build();

      expect(data.ipAddress).toBe('10.0.0.1');
   });

   it('should support withAccount with object or separate arguments', () => {
      const dataWithObj = AuditLogBuilder.create()
         .withAction('AUTH_REGISTER')
         .withAccount({ accountId: 'acc-123', email: 'acc@example.com' })
         .build();

      expect(dataWithObj.accountId).toBe('acc-123');
      expect(dataWithObj.actorEmail).toBe('acc@example.com');

      const dataWithArgs = AuditLogBuilder.create()
         .withAction('AUTH_REGISTER')
         .withAccount('acc-456', 'other@example.com')
         .build();

      expect(dataWithArgs.accountId).toBe('acc-456');
      expect(dataWithArgs.actorEmail).toBe('other@example.com');
   });

   it('should support withActor for email and account ID', () => {
      const data = AuditLogBuilder.create()
         .withAction('AUTH_PASSWORD_CHANGE')
         .withActor('user@example.com', 'user-id-999')
         .build();

      expect(data.actorEmail).toBe('user@example.com');
      expect(data.accountId).toBe('user-id-999');
   });

   it('should support withMetadata and addMetadata for enriching metadata', () => {
      const data = AuditLogBuilder.create()
         .withAction('AUTH_SESSION_REVOKE')
         .withMetadata({ sessionId: 'sess-1' })
         .addMetadata('revokedBy', 'admin')
         .build();

      expect(data.metadata).toEqual({
         sessionId: 'sess-1',
         revokedBy: 'admin',
      });
   });

   it('should support granular location and device setters', () => {
      const data = AuditLogBuilder.create()
         .withAction('AUTH_MFA_VERIFY')
         .withLocation('Tokyo', 'Japan')
         .withBrowser('Firefox')
         .withOs('Linux')
         .withDeviceType('mobile')
         .withDeviceName('Pixel 8')
         .build();

      expect(data.city).toBe('Tokyo');
      expect(data.country).toBe('Japan');
      expect(data.browser).toBe('Firefox');
      expect(data.os).toBe('Linux');
      expect(data.deviceType).toBe('mobile');
      expect(data.deviceName).toBe('Pixel 8');
   });
});
