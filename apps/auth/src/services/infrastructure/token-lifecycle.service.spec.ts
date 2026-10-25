import * as crypto from 'crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { DEFAULT_ROLES, RedisService, UnauthorizedException, uuidv7 } from '@common';
import {
   AUTH_ERROR_CODES,
   DEFAULT_DEV_EC_PRIVATE_KEY,
   DEFAULT_DEV_EC_PUBLIC_KEY,
   DEFAULT_JWT_KEY_ID,
   ITokenAccountPayload,
   JWT_TOKEN_TYPE,
} from '@contracts/auth';
import { AuthConfigService } from '@auth/config';
import { SESSION_REPOSITORY } from '@auth/repositories';
import { JWT_SERVICE } from '@auth/services/infrastructure/token.service.interface';
import { JwtService } from '@auth/services/infrastructure/jwt.service';
import { TokenLifecycleService } from '@auth/services/infrastructure/token-lifecycle.service';
import { AuthRedisKeys, REFRESH_TOKEN_HASH_ALGORITHM, TOKEN_REVOCATION_VALUE } from '@auth/constants';

describe('TokenLifecycleService', () => {
   let service: TokenLifecycleService;
   let jwtService: JwtService;

   const testSecretKey = 'test-refresh-token-secret-for-unit-tests-only-32bytes';

   function hashSecret(secret: string): string {
      return crypto.createHmac(REFRESH_TOKEN_HASH_ALGORITHM, testSecretKey).update(secret).digest('hex');
   }

   const mockRedisService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      sadd: jest.fn(),
      srem: jest.fn(),
      smembers: jest.fn(),
      expire: jest.fn(),
      deleteByPattern: jest.fn(),
      getJson: jest.fn(),
      setJson: jest.fn(),
   };

   const mockCreateSession = jest.fn();
   const mockFindByJti = jest.fn();
   const mockUpdateSession = jest.fn();
   const mockUpdateSessionByJti = jest.fn();
   const mockRevokeAllSessions = jest.fn();

   const mockConfigService = {
      jwtPrivateKey: DEFAULT_DEV_EC_PRIVATE_KEY,
      jwtPublicKey: DEFAULT_DEV_EC_PUBLIC_KEY,
      jwtKeyId: DEFAULT_JWT_KEY_ID,
      jwtAccessTokenExpiresIn: 900,
      jwtRefreshTokenExpiresIn: 604800,
      refreshTokenSecret: testSecretKey,
   };

   beforeEach(async () => {
      jest.clearAllMocks();
      mockRedisService.smembers.mockResolvedValue([]);
      mockRedisService.get.mockResolvedValue(null);
      mockCreateSession.mockResolvedValue({ sessionId: 'session-id-1' });
      mockRevokeAllSessions.mockResolvedValue([]);

      const module: TestingModule = await Test.createTestingModule({
         providers: [
            JwtService,
            {
               provide: JWT_SERVICE,
               useExisting: JwtService,
            },
            TokenLifecycleService,
            {
               provide: AuthConfigService,
               useValue: mockConfigService,
            },
            {
               provide: RedisService,
               useValue: mockRedisService,
            },
            {
               provide: SESSION_REPOSITORY,
               useValue: {
                  createSession: mockCreateSession,
                  findByJti: mockFindByJti,
                  updateSession: mockUpdateSession,
                  updateSessionByJti: mockUpdateSessionByJti,
                  revokeAllSessions: mockRevokeAllSessions,
               },
            },
         ],
      }).compile();

      service = module.get<TokenLifecycleService>(TokenLifecycleService);
      jwtService = module.get<JwtService>(JwtService);
   });

   describe('generateTokenPair', () => {
      it('should generate a pair of ECDSA (ES256) access token and opaque refresh token (<jti>.<secret>) with HMAC-SHA256', async () => {
         const user: ITokenAccountPayload = {
            accountId: 'user-id-1',
            email: 'test@example.com',
            roles: [DEFAULT_ROLES.USER],
         };
         const deviceInfo = {
            deviceType: 'desktop',
            deviceName: 'Chrome on macOS',
            browser: 'Chrome 122.0',
            os: 'macOS 14.3',
            ipAddress: '127.0.0.1',
         };

         const tokens = await service.generateTokenPair(user, deviceInfo);

         expect(tokens.accessToken).toBeDefined();
         expect(tokens.refreshToken).toBeDefined();

         // Verify Refresh Token format: <jti>.<secret>
         const parts = tokens.refreshToken.split('.');
         expect(parts).toHaveLength(2);
         const [jti, secret] = parts;
         expect(jti).toBeDefined();
         expect(secret).toHaveLength(64); // 32 bytes hex

         // Redis whitelist verification (both account:jti and jti-indexed keys)
         expect(mockRedisService.setJson).toHaveBeenCalledWith(
            AuthRedisKeys.refreshToken('user-id-1', jti),
            expect.objectContaining({
               accountId: 'user-id-1',
               email: 'test@example.com',
               jti,
               hash: expect.any(String),
            }),
            mockConfigService.jwtRefreshTokenExpiresIn,
         );
         expect(mockRedisService.setJson).toHaveBeenCalledWith(
            AuthRedisKeys.refreshTokenByJti(jti),
            expect.objectContaining({
               accountId: 'user-id-1',
               jti,
               hash: expect.any(String),
            }),
            mockConfigService.jwtRefreshTokenExpiresIn,
         );

         // DB Session repository verification
         expect(mockCreateSession).toHaveBeenCalledWith(
            expect.objectContaining({
               accountId: 'user-id-1',
               refreshTokenJti: jti,
               refreshTokenHash: expect.any(String),
               deviceType: 'desktop',
               deviceName: 'Chrome on macOS',
            }),
         );
      });
   });

   describe('rotateTokenPair', () => {
      it('should rotate token pair and update existing session record with new opaque token hash', async () => {
         const user: ITokenAccountPayload = {
            accountId: 'user-id-1',
            email: 'test@example.com',
            roles: [DEFAULT_ROLES.USER],
         };

         mockFindByJti.mockResolvedValue({
            sessionId: 'session-id-1',
            accountId: 'user-id-1',
            refreshTokenJti: 'old-jti',
         });

         const tokens = await service.rotateTokenPair(user, 'old-jti');

         expect(tokens.accessToken).toBeDefined();
         expect(tokens.refreshToken).toBeDefined();

         const [newJti, newSecret] = tokens.refreshToken.split('.');
         expect(newJti).toBeDefined();
         expect(newSecret).toHaveLength(64);

         expect(mockUpdateSession).toHaveBeenCalledTimes(1);
         const updateCall = mockUpdateSession.mock.calls[0] as [
            string,
            { refreshTokenJti?: string; refreshTokenHash?: string; isRevoked?: boolean },
         ];
         expect(updateCall[0]).toBe('session-id-1');
         expect(updateCall[1].refreshTokenJti).toBe(newJti);
         expect(updateCall[1].refreshTokenHash).toBe(hashSecret(newSecret));
         expect(updateCall[1].isRevoked).toBe(false);
      });
   });

   describe('validateAccessToken', () => {
      it('should validate a valid access token successfully', async () => {
         const token = jwtService.sign(
            { sub: 'user-1', email: 'user@example.com', tokenType: JWT_TOKEN_TYPE.ACCESS, jti: 'jti-123' },
            900,
         );

         const payload = await service.validateAccessToken(token);
         expect(payload.sub).toBe('user-1');
         expect(payload.tokenType).toBe(JWT_TOKEN_TYPE.ACCESS);
      });

      it('should throw UnauthorizedException if access token JTI is in Redis blacklist', async () => {
         const token = jwtService.sign(
            { sub: 'user-1', email: 'user@example.com', tokenType: JWT_TOKEN_TYPE.ACCESS, jti: 'revoked-jti' },
            900,
         );
         mockRedisService.get.mockImplementation((key: string) => {
            if (key === AuthRedisKeys.revokedToken('revoked-jti')) return Promise.resolve(TOKEN_REVOCATION_VALUE);
            return Promise.resolve(null);
         });

         await expect(service.validateAccessToken(token)).rejects.toThrow(UnauthorizedException);
         try {
            await service.validateAccessToken(token);
         } catch (err) {
            expect((err as UnauthorizedException).errorCode).toBe(AUTH_ERROR_CODES.TOKEN_REVOKED);
         }
      });
   });

   describe('validateRefreshToken', () => {
      it('should validate active opaque refresh token in Redis cache successfully', async () => {
         const jti = uuidv7();
         const secret = crypto.randomBytes(32).toString('hex');
         const token = `${jti}.${secret}`;
         const hash = hashSecret(secret);

         mockRedisService.get.mockResolvedValue(null);
         mockRedisService.getJson.mockResolvedValue({
            accountId: 'user-1',
            email: 'user@example.com',
            roles: [DEFAULT_ROLES.USER],
            jti,
            hash,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 604800000).toISOString(),
         });

         const payload = await service.validateRefreshToken(token);
         expect(payload.sub).toBe('user-1');
         expect(payload.email).toBe('user@example.com');
         expect(payload.roles).toEqual([DEFAULT_ROLES.USER]);
         expect(payload.jti).toBe(jti);
         expect(payload.tokenType).toBe(JWT_TOKEN_TYPE.REFRESH);
      });

      it('should fallback to database when Redis cache misses and validate matching hash', async () => {
         const jti = uuidv7();
         const secret = crypto.randomBytes(32).toString('hex');
         const token = `${jti}.${secret}`;
         const hash = hashSecret(secret);

         mockRedisService.get.mockResolvedValue(null);
         mockRedisService.getJson.mockResolvedValue(null); // Redis cache miss
         mockFindByJti.mockResolvedValue({
            sessionId: 'session-id-1',
            accountId: 'user-1',
            refreshTokenJti: jti,
            refreshTokenHash: hash,
            isRevoked: false,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 604800000).toISOString(),
         });

         const payload = await service.validateRefreshToken(token);
         expect(payload.sub).toBe('user-1');
         expect(payload.jti).toBe(jti);
      });

      it('should throw REFRESH_TOKEN_REQUIRED if token is empty', async () => {
         await expect(service.validateRefreshToken('')).rejects.toThrow(
            expect.objectContaining({ errorCode: AUTH_ERROR_CODES.REFRESH_TOKEN_REQUIRED }),
         );
      });

      it('should throw REFRESH_TOKEN_INVALID if token format is invalid (not jti.secret)', async () => {
         await expect(service.validateRefreshToken('invalid-token')).rejects.toThrow(
            expect.objectContaining({ errorCode: AUTH_ERROR_CODES.REFRESH_TOKEN_INVALID }),
         );
         await expect(service.validateRefreshToken('a.b.c')).rejects.toThrow(
            expect.objectContaining({ errorCode: AUTH_ERROR_CODES.REFRESH_TOKEN_INVALID }),
         );
      });

      it('should throw REFRESH_TOKEN_INVALID if secret length is not 64 hex chars', async () => {
         const jti = uuidv7();
         await expect(service.validateRefreshToken(`${jti}.shortsecret`)).rejects.toThrow(
            expect.objectContaining({ errorCode: AUTH_ERROR_CODES.REFRESH_TOKEN_INVALID }),
         );
      });

      it('should throw REFRESH_TOKEN_INVALID and revoke all tokens if secret does not match stored hash', async () => {
         const jti = uuidv7();
         const secret = crypto.randomBytes(32).toString('hex');
         const token = `${jti}.${secret}`;
         const differentHash = hashSecret('0'.repeat(64));

         mockRedisService.get.mockResolvedValue(null);
         mockRedisService.getJson.mockResolvedValue({
            accountId: 'user-1',
            jti,
            hash: differentHash,
         });

         await expect(service.validateRefreshToken(token)).rejects.toThrow(
            expect.objectContaining({ errorCode: AUTH_ERROR_CODES.REFRESH_TOKEN_INVALID }),
         );
         expect(mockRedisService.del).toHaveBeenCalledWith(AuthRedisKeys.sessions('user-1'));
         expect(mockRevokeAllSessions).toHaveBeenCalledWith('user-1');
      });

      it('should detect token reuse via Redis blacklist and revoke all user sessions', async () => {
         const jti = uuidv7();
         const secret = crypto.randomBytes(32).toString('hex');
         const token = `${jti}.${secret}`;

         mockRedisService.get.mockImplementation((key: string) => {
            if (key === AuthRedisKeys.revokedToken(jti)) return Promise.resolve(TOKEN_REVOCATION_VALUE);
            return Promise.resolve(null);
         });
         mockFindByJti.mockResolvedValue({
            accountId: 'user-compromised',
            refreshTokenJti: jti,
         });

         await expect(service.validateRefreshToken(token)).rejects.toThrow(
            expect.objectContaining({ errorCode: AUTH_ERROR_CODES.REFRESH_TOKEN_REVOKED }),
         );
         expect(mockRedisService.del).toHaveBeenCalledWith(AuthRedisKeys.sessions('user-compromised'));
         expect(mockRevokeAllSessions).toHaveBeenCalledWith('user-compromised');
      });

      it('should detect token reuse if DB session is marked revoked and revoke all user sessions', async () => {
         const jti = uuidv7();
         const secret = crypto.randomBytes(32).toString('hex');
         const token = `${jti}.${secret}`;

         mockRedisService.get.mockResolvedValue(null);
         mockRedisService.getJson.mockResolvedValue(null);
         mockFindByJti.mockResolvedValue({
            accountId: 'user-reuse-db',
            refreshTokenJti: jti,
            isRevoked: true,
            expiresAt: new Date(Date.now() + 60000).toISOString(),
         });

         await expect(service.validateRefreshToken(token)).rejects.toThrow(
            expect.objectContaining({ errorCode: AUTH_ERROR_CODES.REFRESH_TOKEN_REVOKED }),
         );
         expect(mockRevokeAllSessions).toHaveBeenCalledWith('user-reuse-db');
      });
   });

   describe('revokeToken', () => {
      it('should revoke opaque refresh token by JTI and accountId', async () => {
         const jti = uuidv7();
         const secret = crypto.randomBytes(32).toString('hex');
         const token = `${jti}.${secret}`;

         mockRedisService.getJson.mockResolvedValue({ accountId: 'user-1' });

         await service.revokeToken(token);

         expect(mockRedisService.del).toHaveBeenCalledWith(AuthRedisKeys.refreshToken('user-1', jti));
         expect(mockRedisService.del).toHaveBeenCalledWith(AuthRedisKeys.refreshTokenByJti(jti));
         expect(mockRedisService.set).toHaveBeenCalledWith(
            AuthRedisKeys.revokedToken(jti),
            TOKEN_REVOCATION_VALUE,
            mockConfigService.jwtRefreshTokenExpiresIn,
         );
         expect(mockUpdateSessionByJti).toHaveBeenCalledWith(jti, { isRevoked: true });
      });

      it('should revoke access token JWT', async () => {
         const token = jwtService.sign(
            { sub: 'user-1', email: 'user@example.com', tokenType: JWT_TOKEN_TYPE.ACCESS, jti: 'jti-jwt' },
            900,
         );

         await service.revokeToken(token);

         expect(mockRedisService.del).toHaveBeenCalledWith(AuthRedisKeys.refreshToken('user-1', 'jti-jwt'));
         expect(mockRedisService.set).toHaveBeenCalledWith(
            AuthRedisKeys.revokedToken('jti-jwt'),
            TOKEN_REVOCATION_VALUE,
            expect.any(Number),
         );
      });
   });

   describe('revokeAllAccountTokens and logoutAll', () => {
      it('should revoke all tokens and all DB sessions', async () => {
         mockRedisService.smembers.mockResolvedValue(['jti-1', 'jti-2']);

         await service.revokeAllAccountTokens('user-1');

         expect(mockRedisService.del).toHaveBeenCalledWith(AuthRedisKeys.sessions('user-1'));
         expect(mockRevokeAllSessions).toHaveBeenCalledWith('user-1');
      });
   });
});
