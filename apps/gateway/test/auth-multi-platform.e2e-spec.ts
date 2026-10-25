import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { DEFAULT_ROLES, JwtUtil, SERVICES } from '@common';
import { AUTH_PATTERNS, AUTH_RESPONSE_MESSAGES, DEFAULT_DEV_EC_PRIVATE_KEY, USER_STATUS } from '@contracts/auth';
import { GatewayConfigService } from '@/config';
import { GatewayModule } from '@/gateway.module';
import { App } from 'supertest/types';
import { of } from 'rxjs';

describe('Multi-Platform Auth E2E Tests (Web + Mobile)', () => {
   let app: ReturnType<TestingModule['createNestApplication']>;
   let configService: GatewayConfigService;

   const mockUser = {
      id: 'usr_test_123',
      email: 'test@example.com',
      roles: [DEFAULT_ROLES.USER],
      status: USER_STATUS.ACTIVE,
   };

   const mockAuthClient = {
      send: jest.fn((pattern: { cmd: string }, data: unknown) => {
         if (pattern.cmd === AUTH_PATTERNS.REGISTER) {
            const dto = data as { email: string };
            return of({
               user: {
                  id: mockUser.id,
                  email: dto.email,
                  roles: mockUser.roles,
                  status: mockUser.status,
               },
               accessToken: 'mock.access.token.register',
               refreshToken: 'mock.refresh.token.register',
            });
         }
         if (pattern.cmd === 'auth.login') {
            const dto = data as { email: string };
            return of({
               user: {
                  id: mockUser.id,
                  email: dto.email,
                  roles: mockUser.roles,
                  status: mockUser.status,
               },
               accessToken: 'mock.access.token.login',
               refreshToken: 'mock.refresh.token.login',
            });
         }
         if (pattern.cmd === 'auth.refresh_token') {
            return of({
               user: mockUser,
               accessToken: 'mock.access.token.refreshed',
               refreshToken: 'mock.refresh.token.refreshed',
            });
         }
         if (pattern.cmd === 'auth.revoke_token') {
            return of({ success: true, message: 'Token revoked successfully' });
         }
         if (pattern.cmd === 'auth.get_sessions') {
            return of([
               {
                  id: 'session-1',
                  userId: mockUser.id,
                  jti: 'jti-current',
                  deviceName: 'Chrome on macOS',
                  deviceType: 'browser',
                  ipAddress: '127.0.0.1',
                  isCurrent: true,
                  lastActiveAt: new Date().toISOString(),
                  createdAt: new Date().toISOString(),
               },
               {
                  id: 'session-2',
                  userId: mockUser.id,
                  jti: 'jti-other',
                  deviceName: 'iPhone 14',
                  deviceType: 'mobile',
                  clientType: 'ios',
                  deviceId: 'device-ios-123',
                  ipAddress: '192.168.1.100',
                  isCurrent: false,
                  lastActiveAt: new Date().toISOString(),
                  createdAt: new Date().toISOString(),
               },
            ]);
         }
         if (pattern.cmd === 'auth.revoke_other_sessions') {
            return of({
               success: true,
               message: 'All other sessions revoked successfully',
               revokedCount: 1,
            });
         }
         return of(null);
      }),
   };

   beforeEach(async () => {
      jest.clearAllMocks();

      const moduleFixture: TestingModule = await Test.createTestingModule({
         imports: [GatewayModule],
      })
         .overrideProvider(SERVICES.AUTH_SERVICE)
         .useValue(mockAuthClient)
         .compile();

      app = moduleFixture.createNestApplication();
      app.use(cookieParser());
      await app.init();
      configService = app.get(GatewayConfigService);
   });

   afterEach(async () => {
      await app.close();
   });

   describe('Web Auth Flow (Cookie-based)', () => {
      it('should register and set HttpOnly cookies', async () => {
         const res = await request(app.getHttpServer() as App)
            .post('/auth/register')
            .send({
               email: 'web@example.com',
               password: 'password123',
               confirmPassword: 'password123',
            })
            .expect(201);

         // Verify Set-Cookie headers
         const cookies = res.get('Set-Cookie');
         expect(cookies).toBeDefined();
         expect(cookies?.length).toBeGreaterThanOrEqual(2);

         const accessTokenCookie = cookies?.find((c) => c.includes('access_token='));
         const refreshTokenCookie = cookies?.find((c) => c.includes('refresh_token='));

         expect(accessTokenCookie).toBeDefined();
         expect(refreshTokenCookie).toBeDefined();
         expect(accessTokenCookie).toContain('HttpOnly');
         expect(refreshTokenCookie).toContain('HttpOnly');
         expect(accessTokenCookie).toContain('mock.access.token.register');
         expect(refreshTokenCookie).toContain('mock.refresh.token.register');

         // Verify response body
         const body = res.body as { user: unknown; tokens: { accessToken: string; refreshToken: string } };
         expect(body.user).toBeDefined();
         expect(body.tokens).toBeDefined();
         expect(body.tokens.accessToken).toBe('mock.access.token.register');
         expect(body.tokens.refreshToken).toBe('mock.refresh.token.register');
      });

      it('should login and set HttpOnly cookies', async () => {
         const res = await request(app.getHttpServer() as App)
            .post('/auth/login')
            .send({
               email: 'web@example.com',
               password: 'password123',
            })
            .expect(200);

         const cookies = res.get('Set-Cookie');
         expect(cookies).toBeDefined();

         const accessTokenCookie = cookies?.find((c) => c.includes('access_token='));
         const refreshTokenCookie = cookies?.find((c) => c.includes('refresh_token='));

         expect(accessTokenCookie).toBeDefined();
         expect(refreshTokenCookie).toBeDefined();
         expect(accessTokenCookie).toContain('HttpOnly');
         expect(refreshTokenCookie).toContain('HttpOnly');
      });

      it('should refresh token via cookie and return new cookies', async () => {
         const res = await request(app.getHttpServer() as App)
            .post('/auth/refresh')
            .set('Cookie', ['refresh_token=valid.refresh.token.from.cookie'])
            .send({})
            .expect(200);

         const cookies = res.get('Set-Cookie');
         expect(cookies).toBeDefined();

         const accessTokenCookie = cookies?.find((c) => c.includes('access_token='));
         const refreshTokenCookie = cookies?.find((c) => c.includes('refresh_token='));

         expect(accessTokenCookie).toContain('mock.access.token.refreshed');
         expect(refreshTokenCookie).toContain('mock.refresh.token.refreshed');

         // Verify response body also contains tokens
         const body = res.body as { user: unknown; tokens: { accessToken: string } };
         expect(body.tokens.accessToken).toBe('mock.access.token.refreshed');
      });

      it('should get sessions list using cookie authentication', async () => {
         const privateKey = JwtUtil.readKeyFile('apps/auth/keys/private.key') || DEFAULT_DEV_EC_PRIVATE_KEY;
         const accessToken = JwtUtil.sign(
            { sub: mockUser.id, email: mockUser.email, roles: mockUser.roles, tokenType: 'access' },
            privateKey,
            3600,
            { keyid: configService.jwtKeyId },
         );
         const refreshToken = JwtUtil.sign(
            { sub: mockUser.id, tokenType: 'refresh', jti: 'jti-current' },
            privateKey,
            604800,
            { keyid: configService.jwtKeyId },
         );

         const res = await request(app.getHttpServer() as App)
            .get('/auth/sessions')
            .set('Cookie', [`access_token=${accessToken}`, `refresh_token=${refreshToken}`])
            .expect(200);

         const body = res.body as Array<{ id: string; deviceName: string; isCurrent: boolean }>;
         expect(Array.isArray(body)).toBe(true);
         expect(body.length).toBeGreaterThan(0);
         expect(body[0]).toHaveProperty('deviceName');
         expect(body[0]).toHaveProperty('isCurrent');
      });

      it('should revoke other sessions using cookie authentication', async () => {
         const privateKey = JwtUtil.readKeyFile('apps/auth/keys/private.key') || DEFAULT_DEV_EC_PRIVATE_KEY;
         const accessToken = JwtUtil.sign(
            { sub: mockUser.id, email: mockUser.email, roles: mockUser.roles, tokenType: 'access' },
            privateKey,
            3600,
            { keyid: configService.jwtKeyId },
         );
         const refreshToken = JwtUtil.sign(
            { sub: mockUser.id, tokenType: 'refresh', jti: 'jti-current' },
            privateKey,
            604800,
            { keyid: configService.jwtKeyId },
         );

         const res = await request(app.getHttpServer() as App)
            .post('/auth/sessions/revoke-others')
            .set('Cookie', [`access_token=${accessToken}`, `refresh_token=${refreshToken}`])
            .expect(200);

         const body = res.body as { message: string; revokedCount?: number };
         expect(body.message).toBeDefined();
         expect(body.revokedCount).toBe(1);
      });

      it('should logout and clear cookies', async () => {
         const res = await request(app.getHttpServer() as App)
            .post('/auth/logout')
            .set('Cookie', ['refresh_token=token.to.revoke'])
            .expect(200);

         const cookies = res.get('Set-Cookie');
         expect(cookies).toBeDefined();
         expect(cookies?.some((c) => c.includes('access_token=;'))).toBe(true);
         expect(cookies?.some((c) => c.includes('refresh_token=;'))).toBe(true);
      });
   });

   describe('Mobile Auth Flow (Bearer Token-based)', () => {
      it('should register with mobile headers and return tokens in JSON body', async () => {
         const res = await request(app.getHttpServer() as App)
            .post('/auth/register')
            .set('X-Client-Type', 'ios')
            .set('X-Device-Id', 'device-ios-uuid-123')
            .send({
               email: 'mobile@example.com',
               password: 'password123',
               confirmPassword: 'password123',
            })
            .expect(201);

         // Verify response body contains tokens object
         const body = res.body as {
            user: { email: string };
            tokens: { accessToken: string; refreshToken: string; tokenType: string; expiresIn: number };
         };

         expect(body.user).toBeDefined();
         expect(body.user.email).toBe('mobile@example.com');

         expect(body.tokens).toBeDefined();
         expect(body.tokens.accessToken).toBe('mock.access.token.register');
         expect(body.tokens.refreshToken).toBe('mock.refresh.token.register');
         expect(body.tokens.tokenType).toBe('Bearer');
         expect(body.tokens.expiresIn).toBeGreaterThan(0);
         expect(typeof body.tokens.expiresIn).toBe('number');

         // Cookies should still be set for compatibility
         const cookies = res.get('Set-Cookie');
         expect(cookies).toBeDefined();
      });

      it('should login with mobile headers and return tokens in JSON body', async () => {
         const res = await request(app.getHttpServer() as App)
            .post('/auth/login')
            .set('X-Client-Type', 'android')
            .set('X-Device-Id', 'device-android-uuid-456')
            .send({
               email: 'mobile@example.com',
               password: 'password123',
            })
            .expect(200);

         const body = res.body as {
            user: unknown;
            tokens: { accessToken: string; refreshToken: string; tokenType: string; expiresIn: number };
         };

         expect(body.tokens).toBeDefined();
         expect(body.tokens.accessToken).toBe('mock.access.token.login');
         expect(body.tokens.refreshToken).toBe('mock.refresh.token.login');
         expect(body.tokens.tokenType).toBe('Bearer');
         expect(body.tokens.expiresIn).toBeGreaterThan(0);
      });

      it('should refresh token via X-Refresh-Token header and return new tokens in JSON', async () => {
         const res = await request(app.getHttpServer() as App)
            .post('/auth/refresh')
            .set('X-Refresh-Token', 'mobile.refresh.token')
            .set('X-Client-Type', 'ios')
            .send({})
            .expect(200);

         const body = res.body as {
            user: unknown;
            tokens: { accessToken: string; refreshToken: string; tokenType: string; expiresIn: number };
         };

         expect(body.tokens).toBeDefined();
         expect(body.tokens.accessToken).toBe('mock.access.token.refreshed');
         expect(body.tokens.refreshToken).toBe('mock.refresh.token.refreshed');
         expect(body.tokens.tokenType).toBe('Bearer');
         expect(body.tokens.expiresIn).toBeGreaterThan(0);
      });

      it('should refresh token via JSON body and return new tokens', async () => {
         const res = await request(app.getHttpServer() as App)
            .post('/auth/refresh')
            .set('X-Client-Type', 'android')
            .send({
               refreshToken: 'mobile.refresh.token.from.body',
            })
            .expect(200);

         const body = res.body as { tokens: { accessToken: string; refreshToken: string } };
         expect(body.tokens.accessToken).toBe('mock.access.token.refreshed');
         expect(body.tokens.refreshToken).toBe('mock.refresh.token.refreshed');
      });

      it('should get sessions list using Bearer token authentication', async () => {
         const privateKey = JwtUtil.readKeyFile('apps/auth/keys/private.key') || DEFAULT_DEV_EC_PRIVATE_KEY;
         const accessToken = JwtUtil.sign(
            { sub: mockUser.id, email: mockUser.email, roles: mockUser.roles, tokenType: 'access', jti: 'jti-mobile' },
            privateKey,
            3600,
            { keyid: configService.jwtKeyId },
         );

         const res = await request(app.getHttpServer() as App)
            .get('/auth/sessions')
            .set('Authorization', `Bearer ${accessToken}`)
            .set('X-Client-Type', 'ios')
            .expect(200);

         const body = res.body as Array<{
            id: string;
            deviceName: string;
            deviceType?: string;
            clientType?: string;
            deviceId?: string;
            isCurrent: boolean;
         }>;

         expect(Array.isArray(body)).toBe(true);
         expect(body.length).toBeGreaterThan(0);

         // Verify mobile session details
         const mobileSession = body.find((s) => s.deviceType === 'mobile');
         expect(mobileSession).toBeDefined();
         expect(mobileSession?.clientType).toBeDefined();
         expect(mobileSession?.deviceId).toBeDefined();
      });

      it('should revoke token via Authorization Bearer header', async () => {
         const res = await request(app.getHttpServer() as App)
            .post('/auth/revoke')
            .set('Authorization', 'Bearer mobile.token.to.revoke')
            .set('X-Client-Type', 'ios')
            .expect(200);

         const body = res.body as { message: string };
         expect(body.message).toBeDefined();
         expect(body.message).toBe(AUTH_RESPONSE_MESSAGES.TOKEN_REVOKE_SUCCESS);
      });

      it('should logout via Authorization Bearer header', async () => {
         const res = await request(app.getHttpServer() as App)
            .post('/auth/logout')
            .set('Authorization', 'Bearer mobile.token.to.logout')
            .set('X-Client-Type', 'android')
            .expect(200);

         const body = res.body as { message: string };
         expect(body.message).toBeDefined();
         expect(body.message).toBe(AUTH_RESPONSE_MESSAGES.LOGOUT_SUCCESS);
      });

      it('should access protected endpoint with Bearer token', async () => {
         const privateKey = JwtUtil.readKeyFile('apps/auth/keys/private.key') || DEFAULT_DEV_EC_PRIVATE_KEY;
         const accessToken = JwtUtil.sign(
            { sub: mockUser.id, email: mockUser.email, roles: mockUser.roles, tokenType: 'access' },
            privateKey,
            3600,
            { keyid: configService.jwtKeyId },
         );

         const res = await request(app.getHttpServer() as App)
            .get('/auth/me')
            .set('Authorization', `Bearer ${accessToken}`)
            .set('X-Client-Type', 'ios')
            .expect(200);

         const body = res.body as { sub: string; email: string };
         expect(body.sub).toBe(mockUser.id);
         expect(body.email).toBe(mockUser.email);
      });
   });

   describe('Cross-platform compatibility', () => {
      it('should handle web client using Bearer token (backward compatibility)', async () => {
         const privateKey = JwtUtil.readKeyFile('apps/auth/keys/private.key') || DEFAULT_DEV_EC_PRIVATE_KEY;
         const accessToken = JwtUtil.sign(
            { sub: mockUser.id, email: mockUser.email, roles: mockUser.roles, tokenType: 'access' },
            privateKey,
            3600,
            { keyid: configService.jwtKeyId },
         );

         const res = await request(app.getHttpServer() as App)
            .get('/auth/me')
            .set('Authorization', `Bearer ${accessToken}`)
            .expect(200);

         expect(res.status).toBe(200);
      });

      it('should handle mobile client receiving cookies (forward compatibility)', async () => {
         const res = await request(app.getHttpServer() as App)
            .post('/auth/login')
            .set('X-Client-Type', 'ios')
            .send({
               email: 'mobile@example.com',
               password: 'password123',
            })
            .expect(200);

         // Mobile client gets both cookies and tokens
         const cookies = res.get('Set-Cookie');
         const body = res.body as { tokens: unknown };

         expect(cookies).toBeDefined();
         expect(body.tokens).toBeDefined();
      });

      it('should prioritize cookie over Bearer token when both are present', async () => {
         const privateKey = JwtUtil.readKeyFile('apps/auth/keys/private.key') || DEFAULT_DEV_EC_PRIVATE_KEY;
         const cookieToken = JwtUtil.sign(
            { sub: 'cookie-user-id', email: 'cookie@example.com', roles: [DEFAULT_ROLES.USER], tokenType: 'access' },
            privateKey,
            3600,
            { keyid: configService.jwtKeyId },
         );
         const bearerToken = JwtUtil.sign(
            { sub: 'bearer-user-id', email: 'bearer@example.com', roles: [DEFAULT_ROLES.USER], tokenType: 'access' },
            privateKey,
            3600,
            { keyid: configService.jwtKeyId },
         );

         const res = await request(app.getHttpServer() as App)
            .get('/auth/me')
            .set('Authorization', `Bearer ${bearerToken}`)
            .set('Cookie', [`access_token=${cookieToken}`])
            .expect(200);

         const body = res.body as { sub: string; email: string };
         // Cookie should take precedence
         expect(body.sub).toBe('cookie-user-id');
         expect(body.email).toBe('cookie@example.com');
      });
   });
});
