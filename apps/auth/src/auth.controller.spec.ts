import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RmqContext } from '@nestjs/microservices';
import { of } from 'rxjs';
import {
   BloomFilterService,
   CommandBus,
   DEFAULT_ROLES,
   ISupplierOnboardingCompletedEvent,
   RbacCacheService,
   RedisService,
   RmqService,
   SERVICES,
   type ICommandHandler,
} from '@common';
import {
   DEFAULT_DEV_EC_PRIVATE_KEY,
   DEFAULT_DEV_EC_PUBLIC_KEY,
   DEFAULT_JWT_ALGORITHM,
   DEFAULT_JWT_KEY_ID,
} from '@contracts/auth';
import { AuthController } from '@auth/auth.controller';
import { NOTIFICATION_ADAPTER } from '@auth/adapters';
import { AUTH_COMMAND_HANDLERS } from '@auth/commands';
import { AuthConfigService } from '@auth/config';
import { PrismaService } from '@auth/prisma/prisma.service';
import { UNIT_OF_WORK } from '@auth/unit-of-work';
import {
   ACCOUNT_REPOSITORY,
   AccountRepository,
   AUDIT_LOG_REPOSITORY,
   AuditLogRepository,
   RBAC_REPOSITORY,
   RbacRepository,
   SESSION_REPOSITORY,
   SessionRepository,
} from '@auth/repositories';
import { OUTBOX_REPOSITORY, OutboxRepository } from '@auth/outbox';
import {
   AUTH_METRICS_SERVICE,
   AUTH_RATE_LIMITER,
   AuthRateLimiter,
   AuditLogService,
   EmailBloomFilterService,
   JWT_SERVICE,
   JwtService,
   PASSWORD_HASHER,
   PasswordHasherService,
   TOKEN_LIFECYCLE_SERVICE,
   TokenLifecycleService,
   VERIFICATION_TOKEN_SERVICE,
   VerificationTokenService,
} from '@auth/services/infrastructure';
import {
   AuthCoreService,
   AuthRegistrationService,
   SessionManagementService,
   PasswordManagementService,
   AuthRbacService,
   AuthAccountService,
   AuthLoginService,
   AuthTokenService,
} from '@auth/services/domain';

interface MockUserRecord {
   accountId: string;
   email: string;
   passwordHash: string;
   createdAt: Date;
   updatedAt: Date;
   accountRoles?: Array<{
      role: {
         id: string;
         code: string;
         name: string;
         description: string | null;
      };
   }>;
}

const TEST_PERMISSIONS = {
   USERS_READ: 'users:read',
} as const;

describe('AuthController', () => {
   let authController: AuthController;
   let authCoreService: AuthCoreService;
   let authRegistrationService: AuthRegistrationService;
   let sessionManagementService: SessionManagementService;
   let passwordManagementService: PasswordManagementService;
   let redisService: RedisService;
   let authRbacService: AuthRbacService;

   beforeEach(async () => {
      const usersMap = new Map<string, MockUserRecord>();
      const mockPrisma: Record<string, unknown> = {
         $transaction: jest.fn().mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb(mockPrisma)),
         outboxEvent: {
            create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
               Promise.resolve({
                  id: 'outbox-id-1',
                  ...data,
                  retryCount: 0,
                  lastError: null,
                  processedAt: null,
                  createdAt: new Date(),
                  updatedAt: new Date(),
               }),
            ),
         },
         securityAuditLog: {
            create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
               Promise.resolve({
                  id: 'audit-id-1',
                  ...data,
                  createdAt: new Date(),
               }),
            ),
            findUnique: jest.fn().mockResolvedValue(null),
            findMany: jest.fn().mockResolvedValue([]),
            count: jest.fn().mockResolvedValue(0),
         },
         accountSession: {
            create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
               Promise.resolve({
                  id: 'session-id-1',
                  ...data,
                  isRevoked: false,
                  lastActiveAt: new Date(),
                  createdAt: new Date(),
                  updatedAt: new Date(),
                  expiresAt: new Date(Date.now() + 604800000),
               }),
            ),
            findUnique: jest.fn().mockResolvedValue(null),
            findFirst: jest.fn().mockResolvedValue(null),
            findMany: jest.fn().mockResolvedValue([]),
            update: jest.fn().mockResolvedValue({}),
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
         },
         accountRole: {
            upsert: jest.fn().mockResolvedValue({}),
         },
         account: {
            findFirst: jest
               .fn()
               .mockImplementation(
                  ({ where }: { where: { email?: string; accountId?: string; deletedAt?: unknown } }) => {
                     if (where.email) {
                        for (const u of usersMap.values()) {
                           if (u.email === where.email) return Promise.resolve(u);
                        }
                     }
                     if (where.accountId) {
                        return Promise.resolve(usersMap.get(where.accountId) || null);
                     }
                     return Promise.resolve(null);
                  },
               ),
            findUnique: jest.fn().mockImplementation(({ where }: { where: { email?: string; accountId?: string } }) => {
               if (where.email) {
                  for (const u of usersMap.values()) {
                     if (u.email === where.email) return Promise.resolve(u);
                  }
               }
               if (where.accountId) {
                  return Promise.resolve(usersMap.get(where.accountId) || null);
               }
               return Promise.resolve(null);
            }),
            findMany: jest.fn().mockImplementation(({ select }: { select?: { email?: boolean } }) => {
               if (select?.email) {
                  return Promise.resolve(Array.from(usersMap.values()).map((u) => ({ email: u.email })));
               }
               return Promise.resolve(Array.from(usersMap.values()));
            }),
            create: jest
               .fn()
               .mockImplementation(
                  ({
                     data,
                  }: {
                     data: { accountId: string; email: string; passwordHash: string; createdAt?: Date };
                  }) => {
                     const record: MockUserRecord = {
                        accountId: data.accountId,
                        email: data.email,
                        passwordHash: data.passwordHash,
                        createdAt: data.createdAt || new Date(),
                        updatedAt: new Date(),
                        accountRoles: [
                           {
                              role: {
                                 id: 'role-user-id',
                                 code: DEFAULT_ROLES.USER,
                                 name: 'Standard User',
                                 description: null,
                              },
                           },
                        ],
                     };
                     usersMap.set(data.accountId, record);
                     return Promise.resolve(record);
                  },
               ),
            update: jest
               .fn()
               .mockImplementation(
                  ({
                     where,
                     data,
                  }: {
                     where: { accountId: string };
                     data: Partial<{ email: string; passwordHash: string }>;
                  }) => {
                     const existing = usersMap.get(where.accountId);
                     if (!existing) return Promise.reject(new Error('Not found'));
                     const updated: MockUserRecord = { ...existing, ...data, updatedAt: new Date() };
                     usersMap.set(where.accountId, updated);
                     return Promise.resolve(updated);
                  },
               ),
            delete: jest.fn().mockImplementation(({ where }: { where: { accountId: string } }) => {
               usersMap.delete(where.accountId);
               return Promise.resolve({});
            }),
         },
         role: {
            findFirst: jest.fn().mockResolvedValue({
               id: 'role-user-id',
               code: DEFAULT_ROLES.USER,
               name: 'Standard User',
               description: null,
               rolePermissions: [
                  {
                     permission: {
                        id: 'perm-1',
                        code: TEST_PERMISSIONS.USERS_READ,
                        name: 'Read Users',
                        description: null,
                     },
                  },
               ],
            }),
            findUnique: jest.fn().mockResolvedValue({
               id: 'role-user-id',
               code: DEFAULT_ROLES.USER,
               name: 'Standard User',
               description: null,
               rolePermissions: [
                  {
                     permission: {
                        id: 'perm-1',
                        code: TEST_PERMISSIONS.USERS_READ,
                        name: 'Read Users',
                        description: null,
                     },
                  },
               ],
            }),
         },
      };

      const mockRbacCacheService = {
         getRole: jest.fn().mockResolvedValue({
            id: 'role-user-id',
            code: DEFAULT_ROLES.USER,
            name: 'Standard User',
            permissions: [TEST_PERMISSIONS.USERS_READ],
         }),
         setRole: jest.fn().mockResolvedValue(undefined),
         getRolePermissions: jest.fn().mockResolvedValue([TEST_PERMISSIONS.USERS_READ]),
         setRolePermissions: jest.fn().mockResolvedValue(undefined),
         invalidateRole: jest.fn().mockResolvedValue(undefined),
      };

      const redisStorage = new Map<string, string>();
      const redisSets = new Map<string, Set<string>>();

      const mockRedisService = {
         getClient: jest.fn().mockReturnValue(null),
         get: jest.fn().mockImplementation((key: string) => Promise.resolve(redisStorage.get(key) || null)),
         set: jest.fn().mockImplementation((key: string, value: string) => {
            redisStorage.set(key, value);
            return Promise.resolve();
         }),
         del: jest.fn().mockImplementation((key: string) => {
            redisStorage.delete(key);
            redisSets.delete(key);
            return Promise.resolve(1);
         }),
         incr: jest.fn().mockImplementation((key: string) => {
            const current = Number(redisStorage.get(key) || 0) + 1;
            redisStorage.set(key, String(current));
            return Promise.resolve(current);
         }),
         ttl: jest.fn().mockImplementation((key: string) => {
            return Promise.resolve(redisStorage.has(key) ? 900 : -2);
         }),
         sadd: jest.fn().mockImplementation((key: string, ...members: string[]) => {
            if (!redisSets.has(key)) redisSets.set(key, new Set());
            const set = redisSets.get(key)!;
            members.forEach((m) => set.add(m));
            return Promise.resolve();
         }),
         srem: jest.fn().mockImplementation((key: string, ...members: string[]) => {
            const set = redisSets.get(key);
            if (set) {
               members.forEach((m) => set.delete(m));
            }
            return Promise.resolve();
         }),
         smembers: jest.fn().mockImplementation((key: string) => {
            const set = redisSets.get(key);
            return Promise.resolve(set ? Array.from(set) : []);
         }),
         expire: jest.fn().mockResolvedValue(undefined),
         deleteByPattern: jest.fn().mockImplementation((pattern: string) => {
            let deleted = 0;
            const prefix = pattern.replace('*', '');
            for (const key of redisStorage.keys()) {
               if (key.startsWith(prefix)) {
                  redisStorage.delete(key);
                  deleted++;
               }
            }
            return Promise.resolve(deleted);
         }),
         getJson: jest.fn().mockImplementation((key: string) => {
            const raw = redisStorage.get(key);
            return Promise.resolve(raw ? JSON.parse(raw) : null);
         }),
         setJson: jest.fn().mockImplementation((key: string, value: unknown) => {
            redisStorage.set(key, JSON.stringify(value));
            return Promise.resolve();
         }),
      };

      const mockNotificationClient = {
         emit: jest.fn().mockReturnValue(of(true)),
         send: jest.fn().mockReturnValue(of(true)),
      };

      const mockNotificationAdapter = {
         sendRegistrationOtp: jest.fn().mockResolvedValue(undefined),
         sendChangePasswordOtp: jest.fn().mockResolvedValue(undefined),
         sendSecurityAlert: jest.fn().mockResolvedValue(undefined),
         sendPasswordChangedConfirmation: jest.fn().mockResolvedValue(undefined),
         sendWelcomeEmail: jest.fn().mockResolvedValue(undefined),
         sendEmail: jest.fn().mockResolvedValue(undefined),
      };

      const module: TestingModule = await Test.createTestingModule({
         controllers: [AuthController],
         providers: [
            JwtService,
            {
               provide: JWT_SERVICE,
               useExisting: JwtService,
            },
            VerificationTokenService,
            {
               provide: VERIFICATION_TOKEN_SERVICE,
               useExisting: VerificationTokenService,
            },
            TokenLifecycleService,
            {
               provide: TOKEN_LIFECYCLE_SERVICE,
               useExisting: TokenLifecycleService,
            },
            AuthRateLimiter,
            {
               provide: AUTH_RATE_LIMITER,
               useExisting: AuthRateLimiter,
            },
            PasswordHasherService,
            {
               provide: PASSWORD_HASHER,
               useExisting: PasswordHasherService,
            },
            AuthCoreService,
            AuthRegistrationService,
            SessionManagementService,
            PasswordManagementService,
            AuthRbacService,
            AuthAccountService,
            AuthLoginService,
            AuthTokenService,
            {
               provide: AuditLogService,
               useValue: {
                  record: jest.fn().mockResolvedValue(null),
                  getAuditLogs: jest.fn().mockResolvedValue({ data: [], total: 0 }),
                  getAuditLogById: jest.fn().mockResolvedValue(null),
                  getAccountAuditLogs: jest.fn().mockResolvedValue({ data: [], total: 0 }),
                  getSecurityScore: jest.fn().mockResolvedValue(null),
                  getThreatMetrics: jest.fn().mockResolvedValue(null),
                  rebuildProjections: jest.fn().mockResolvedValue({ replayedCount: 0, durationMs: 0 }),
               },
            },
            EmailBloomFilterService,
            BloomFilterService,
            {
               provide: UNIT_OF_WORK,
               useFactory: (accountRepo: AccountRepository, outboxRepo: OutboxRepository) => ({
                  runInTransaction: jest
                     .fn()
                     .mockImplementation((work: (tx: unknown) => Promise<unknown>) =>
                        work({ accountRepository: accountRepo, outboxRepository: outboxRepo }),
                     ),
               }),
               inject: [ACCOUNT_REPOSITORY, OUTBOX_REPOSITORY],
            },
            {
               provide: AUTH_METRICS_SERVICE,
               useValue: {
                  recordLoginAttempt: jest.fn(),
                  recordRegistrationAttempt: jest.fn(),
                  recordTokenOperation: jest.fn(),
                  recordOtpOperation: jest.fn(),
                  recordSessionOperation: jest.fn(),
                  setActiveSessions: jest.fn(),
                  setLockedAccounts: jest.fn(),
                  setOutboxPending: jest.fn(),
                  observeTokenGeneration: jest.fn(),
                  observeLoginDuration: jest.fn(),
                  observePasswordHash: jest.fn(),
                  observeOtpOperation: jest.fn(),
                  startTimer: jest.fn().mockReturnValue(100),
                  calculateDuration: jest.fn().mockReturnValue(0.05),
                  getMetrics: jest.fn(),
                  reset: jest.fn(),
               },
            },
            {
               provide: ACCOUNT_REPOSITORY,
               useClass: AccountRepository,
            },
            {
               provide: RBAC_REPOSITORY,
               useClass: RbacRepository,
            },
            {
               provide: OUTBOX_REPOSITORY,
               useClass: OutboxRepository,
            },
            {
               provide: SESSION_REPOSITORY,
               useClass: SessionRepository,
            },
            {
               provide: AUDIT_LOG_REPOSITORY,
               useClass: AuditLogRepository,
            },
            {
               provide: SERVICES.NOTIFICATION_SERVICE,
               useValue: mockNotificationClient,
            },
            {
               provide: NOTIFICATION_ADAPTER,
               useValue: mockNotificationAdapter,
            },
            {
               provide: PrismaService,
               useValue: mockPrisma,
            },
            {
               provide: AuthConfigService,
               useValue: {
                  jwtPrivateKey: DEFAULT_DEV_EC_PRIVATE_KEY,
                  jwtPublicKey: DEFAULT_DEV_EC_PUBLIC_KEY,
                  jwtKeyId: DEFAULT_JWT_KEY_ID,
                  jwtAccessTokenExpiresIn: 900,
                  jwtRefreshTokenExpiresIn: 604800,
                  jwtExpiresIn: 86400,
                  argon2Secret: 'test-argon2-secret',
                  refreshTokenSecret: 'test-refresh-token-secret-for-unit-tests-only-32bytes',
               },
            },
            {
               provide: RmqService,
               useValue: {
                  ack: jest.fn(),
                  nack: jest.fn(),
                  handleError: jest.fn(),
               },
            },
            {
               provide: RbacCacheService,
               useValue: mockRbacCacheService,
            },
            {
               provide: RedisService,
               useValue: mockRedisService,
            },
            {
               provide: EventEmitter2,
               useValue: { emit: jest.fn() },
            },
            CommandBus,
            ...AUTH_COMMAND_HANDLERS,
         ],
      }).compile();

      const commandBus = module.get<CommandBus>(CommandBus);
      for (const handlerClass of AUTH_COMMAND_HANDLERS) {
         const handler = module.get<ICommandHandler<never, never>>(handlerClass);
         if (handler) {
            commandBus.registerHandler(handler);
         }
      }

      authController = module.get<AuthController>(AuthController);
      authCoreService = module.get<AuthCoreService>(AuthCoreService);
      authRegistrationService = module.get<AuthRegistrationService>(AuthRegistrationService);
      sessionManagementService = module.get<SessionManagementService>(SessionManagementService);
      passwordManagementService = module.get<PasswordManagementService>(PasswordManagementService);
      redisService = module.get<RedisService>(RedisService);
      authRbacService = module.get<AuthRbacService>(AuthRbacService);
   });

   it('should be defined', () => {
      expect(authController).toBeDefined();
      expect(authCoreService).toBeDefined();
      expect(authRegistrationService).toBeDefined();
      expect(sessionManagementService).toBeDefined();
      expect(passwordManagementService).toBeDefined();
   });

   it('should handle getJwks message', async () => {
      const mockContext = {
         getChannelRef: jest.fn(),
         getMessage: jest.fn(),
      } as unknown as RmqContext;

      const jwks = await authController.getJwks(mockContext);
      expect(jwks).toBeDefined();
      expect(Array.isArray(jwks.keys)).toBe(true);
      expect(jwks.keys[0].kty).toBe('EC');
      expect(jwks.keys[0].crv).toBe('P-256');
      expect(jwks.keys[0].alg).toBe(DEFAULT_JWT_ALGORITHM);
   });

   it('should handle sendRegisterOtp and verifyRegisterOtp message pattern', async () => {
      const mockContext = {
         getChannelRef: jest.fn(),
         getMessage: jest.fn(),
      } as unknown as RmqContext;

      const sendOtpRes = await authController.sendRegisterOtp({ email: 'otpuser@example.com' }, mockContext);
      expect(sendOtpRes.success).toBe(true);
      expect(sendOtpRes.cooldownSeconds).toBe(60);

      // Verify OTP after retrieving from Redis
      const otpKey = `auth:otp:register:otpuser@example.com`;
      const otp = await redisService.get(otpKey);
      expect(otp).toBeDefined();

      const verifyRes = await authController.verifyRegisterOtp(
         { email: 'otpuser@example.com', otp: otp as string },
         mockContext,
      );
      expect(verifyRes.success).toBe(true);
      expect(verifyRes.verificationToken).toBeDefined();
   });

   it('should register a user successfully', async () => {
      const mockContext = {
         getChannelRef: jest.fn(),
         getMessage: jest.fn(),
      } as unknown as RmqContext;

      const registerDto = {
         email: 'test@example.com',
         password: 'Password123!',
         confirmPassword: 'Password123!',
      };

      const registerRes = await authController.register(registerDto, mockContext);

      expect(registerRes.user.email).toBe('test@example.com');
      expect(registerRes.accessToken).toBeDefined();
      expect(registerRes.refreshToken).toBeDefined();
   });

   it('should handle getSessions message', async () => {
      const mockContext = {
         getChannelRef: jest.fn(),
         getMessage: jest.fn(),
      } as unknown as RmqContext;

      const sessions = await authController.getSessions({ userId: 'user-1' }, mockContext);
      expect(Array.isArray(sessions)).toBe(true);
   });

   it('should handle revokeSession message', async () => {
      const mockContext = {
         getChannelRef: jest.fn(),
         getMessage: jest.fn(),
      } as unknown as RmqContext;

      const result = await authController.revokeOtherSessions({ userId: 'user-1', currentJti: 'jti-1' }, mockContext);
      expect(result.revokedCount).toBeDefined();
   });

   it('should handle getAuditLogs message with admin role', async () => {
      const mockContext = {
         getChannelRef: jest.fn(),
         getMessage: jest.fn(),
      } as unknown as RmqContext;

      const logs = await authController.getAuditLogs(
         {
            data: { page: 1, limit: 10 },
            user: {
               userId: 'admin-1',
               email: 'admin@example.com',
               roles: [DEFAULT_ROLES.ADMIN],
               permissions: [],
            },
         },
         mockContext,
      );
      expect(logs).toBeDefined();
      expect(logs.data).toEqual([]);
   });

   it('should handle revokeToken message and return success', async () => {
      const mockContext = {
         getChannelRef: jest.fn(),
         getMessage: jest.fn(),
      } as unknown as RmqContext;

      jest.spyOn(authCoreService, 'revokeToken').mockResolvedValue(undefined);

      const result = await authController.revokeToken({ token: 'test-token' }, mockContext);
      expect(result).toEqual({ success: true });
   });

   it('should handle revokeSession message and return success', async () => {
      const mockContext = {
         getChannelRef: jest.fn(),
         getMessage: jest.fn(),
      } as unknown as RmqContext;

      jest.spyOn(sessionManagementService, 'revokeSession').mockResolvedValue(undefined);

      const result = await authController.revokeSession({ userId: 'user-1', sessionId: 'sess-1' }, mockContext);
      expect(result).toEqual({ success: true });
   });

   it('should reject getAuditLogs without admin role', async () => {
      const mockContext = {
         getChannelRef: jest.fn(),
         getMessage: jest.fn(),
      } as unknown as RmqContext;

      await expect(
         authController.getAuditLogs(
            {
               data: { page: 1, limit: 10 },
               user: {
                  userId: 'user-1',
                  email: 'user@example.com',
                  roles: [DEFAULT_ROLES.USER],
                  permissions: [],
               },
            },
            mockContext,
         ),
      ).rejects.toThrow();
   });

   it('should handle getEmail message and return user email', async () => {
      const mockContext = {
         getChannelRef: jest.fn(),
         getMessage: jest.fn(),
      } as unknown as RmqContext;

      jest.spyOn(authCoreService, 'getEmail').mockResolvedValue({
         accountId: 'account-123',
         email: 'test@example.com',
         isEmailVerified: true,
      });

      const result = await authController.getEmail({ accountId: 'account-123' }, mockContext);
      expect(result).toEqual({
         accountId: 'account-123',
         email: 'test@example.com',
         isEmailVerified: true,
      });
   });

   it('should throw BadRequestException when accountId is missing in getEmail', async () => {
      const mockContext = {
         getChannelRef: jest.fn(),
         getMessage: jest.fn(),
      } as unknown as RmqContext;

      await expect(authController.getEmail({ accountId: '' }, mockContext)).rejects.toThrow();
   });

   it('should handle handleSupplierOnboardingCompleted event and ack context', async () => {
      const mockContext = {
         getChannelRef: jest.fn(),
         getMessage: jest.fn(),
      } as unknown as RmqContext;

      jest.spyOn(authRbacService, 'assignRoleToAccount').mockResolvedValue(undefined);

      const mockEvent: ISupplierOnboardingCompletedEvent = {
         accountId: 'acc-onboard-1',
         supplierId: 'sup-1',
         role: 'SUPPLIER_ADMIN',
      };

      await authController.handleSupplierOnboardingCompleted(mockEvent, mockContext);

      expect(authRbacService.assignRoleToAccount).toHaveBeenCalledWith(mockEvent.accountId, mockEvent.role);
   });

   it('should skip elevation if required fields are missing in supplier onboarding event', async () => {
      const mockContext = {
         getChannelRef: jest.fn(),
         getMessage: jest.fn(),
      } as unknown as RmqContext;

      const assignSpy = jest.spyOn(authRbacService, 'assignRoleToAccount').mockResolvedValue(undefined);
      assignSpy.mockClear();

      await authController.handleSupplierOnboardingCompleted(
         { accountId: '', supplierId: 'sup-1', role: '' },
         mockContext,
      );

      expect(assignSpy).not.toHaveBeenCalled();
   });
});
