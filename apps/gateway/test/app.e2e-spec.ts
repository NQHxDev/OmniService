import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AllExceptionsFilter, DEFAULT_DEV_EC_PRIVATE_KEY, DEFAULT_ROLES, JwtUtil, SERVICES } from '@common';
import { AUTH_PATTERNS, DEFAULT_JWT_ALGORITHM, DEFAULT_JWT_KEY_ID } from '@contracts/auth';
import { GatewayConfigService } from '@/config';
import { GatewayModule } from '@/gateway.module';
import { App } from 'supertest/types';
import { of } from 'rxjs';

describe('GatewayController (e2e)', () => {
   let app: ReturnType<TestingModule['createNestApplication']>;
   let configService: GatewayConfigService;

   const mockAuthClient = {
      send: jest.fn((pattern: { cmd: string }, data: unknown) => {
         if (pattern.cmd === AUTH_PATTERNS.GET_JWKS) {
            return of({
               keys: [
                  {
                     kty: 'RSA',
                     use: 'sig',
                     alg: DEFAULT_JWT_ALGORITHM,
                     kid: DEFAULT_JWT_KEY_ID,
                     n: 'mock_n',
                     e: 'AQAB',
                  },
               ],
            });
         }
         if (pattern.cmd === AUTH_PATTERNS.REGISTER) {
            const dto = data as { email: string };
            return of({
               user: {
                  id: 'usr_mock_123',
                  email: dto.email,
                  createdAt: new Date().toISOString(),
               },
               accessToken: 'mock.access.token',
               refreshToken: 'mock.refresh.token',
            });
         }
         if (pattern.cmd === 'auth.login') {
            const dto = data as { email: string };
            return of({
               user: {
                  id: 'usr_mock_123',
                  email: dto.email,
                  createdAt: new Date().toISOString(),
               },
               accessToken: 'mock.access.token',
               refreshToken: 'mock.refresh.token',
            });
         }
         return of(null);
      }),
   };

   beforeEach(async () => {
      const moduleFixture: TestingModule = await Test.createTestingModule({
         imports: [GatewayModule],
      })
         .overrideProvider(SERVICES.AUTH_SERVICE)
         .useValue(mockAuthClient)
         .compile();

      app = moduleFixture.createNestApplication();
      app.use(cookieParser());
      app.useGlobalFilters(new AllExceptionsFilter());
      await app.init();
      configService = app.get(GatewayConfigService);
   });

   afterEach(async () => {
      await app.close();
   });

   it('/ (HEAD) - root endpoint should return 200 without body', async () => {
      await request(app.getHttpServer() as App)
         .head('/')
         .expect(200);
   });

   it('/ (GET) - root endpoint should return 200 with status ok', async () => {
      const res = await request(app.getHttpServer() as App)
         .get('/')
         .expect(200);

      const body = res.body as { status: string };
      expect(body.status).toBe('ok');
   });

   it('/health (HEAD) - health endpoint should return 200 without body', async () => {
      await request(app.getHttpServer() as App)
         .head('/health')
         .expect(200);
   });

   it('/health (GET) - public route should be accessible without token', async () => {
      const res = await request(app.getHttpServer() as App)
         .get('/health')
         .expect(200);

      const body = res.body as { status: string };
      expect(body.status).toBe('ok');
   });

   it('/auth/.well-known/jwks.json (GET) - public JWKS endpoint should return key set', async () => {
      const res = await request(app.getHttpServer() as App)
         .get('/auth/.well-known/jwks.json')
         .expect(200);

      const body = res.body as { keys: Array<{ kty: string; alg: string }> };
      expect(body.keys).toBeDefined();
      expect(body.keys.length).toBeGreaterThan(0);
      expect(body.keys[0].kty).toBe('EC');
      expect(body.keys[0].alg).toBe(DEFAULT_JWT_ALGORITHM);
   });

   it('/auth/jwks.json (GET) - public JWKS alias endpoint should return key set', async () => {
      const res = await request(app.getHttpServer() as App)
         .get('/auth/jwks.json')
         .expect(200);

      const body = res.body as { keys: Array<{ kty: string; alg: string }> };
      expect(body.keys).toBeDefined();
      expect(body.keys.length).toBeGreaterThan(0);
      expect(body.keys[0].kty).toBe('EC');
   });

   describe('Dual-mode authentication (cookies + response body tokens)', () => {
      it('/auth/register (POST) - should return tokens in both cookies and response body', async () => {
         const res = await request(app.getHttpServer() as App)
            .post('/auth/register')
            .send({
               email: 'john@example.com',
               password: 'password123',
               confirmPassword: 'password123',
            })
            .expect(201);

         // Verify cookies are set
         const cookies = res.get('Set-Cookie');
         expect(cookies).toBeDefined();
         expect(cookies?.some((c) => c.includes('access_token='))).toBe(true);
         expect(cookies?.some((c) => c.includes('refresh_token='))).toBe(true);
         expect(cookies?.some((c) => c.includes('HttpOnly'))).toBe(true);

         // Verify response body contains user and tokens
         const body = res.body as {
            user: { email: string };
            tokens: { accessToken: string; refreshToken: string; tokenType: string; expiresIn: number };
         };
         expect(body.user.email).toBe('john@example.com');
         expect(body.tokens).toBeDefined();
         expect(body.tokens.accessToken).toBe('mock.access.token');
         expect(body.tokens.refreshToken).toBe('mock.refresh.token');
         expect(body.tokens.tokenType).toBe('Bearer');
         expect(body.tokens.expiresIn).toBeGreaterThan(0);
      });

      it('/auth/login (POST) - should return tokens in both cookies and response body', async () => {
         const res = await request(app.getHttpServer() as App)
            .post('/auth/login')
            .send({
               email: 'john@example.com',
               password: 'password123',
            })
            .expect(200);

         // Verify cookies
         const cookies = res.get('Set-Cookie');
         expect(cookies).toBeDefined();
         expect(cookies?.some((c) => c.includes('access_token='))).toBe(true);
         expect(cookies?.some((c) => c.includes('refresh_token='))).toBe(true);

         // Verify response body
         const body = res.body as {
            user: { email: string };
            tokens: { accessToken: string; refreshToken: string; tokenType: string };
         };
         expect(body.user.email).toBe('john@example.com');
         expect(body.tokens).toBeDefined();
         expect(body.tokens.accessToken).toBeDefined();
         expect(body.tokens.refreshToken).toBeDefined();
         expect(body.tokens.tokenType).toBe('Bearer');
      });

      it('/auth/register (POST) - mobile client should use tokens from response body', async () => {
         const res = await request(app.getHttpServer() as App)
            .post('/auth/register')
            .set('X-Client-Type', 'ios')
            .set('X-Device-Id', 'device-uuid-123')
            .send({
               email: 'mobile@example.com',
               password: 'password123',
               confirmPassword: 'password123',
            })
            .expect(201);

         const body = res.body as {
            tokens: { accessToken: string; refreshToken: string; tokenType: string };
         };

         // Mobile client can extract and use these tokens
         expect(body.tokens.accessToken).toBeDefined();
         expect(body.tokens.refreshToken).toBeDefined();
         expect(body.tokens.tokenType).toBe('Bearer');
      });
   });

   it('/auth/logout (POST) - public route should clear both auth cookies', async () => {
      const res = await request(app.getHttpServer() as App)
         .post('/auth/logout')
         .expect(200);

      const cookies = res.get('Set-Cookie');
      expect(cookies).toBeDefined();
      expect(cookies?.some((c) => c.includes('access_token=;'))).toBe(true);
      expect(cookies?.some((c) => c.includes('refresh_token=;'))).toBe(true);
   });

   it('/auth/me (GET) - protected route should reject without token (401)', async () => {
      await request(app.getHttpServer() as App)
         .get('/auth/me')
         .expect(401);
   });

   it('/auth/me (GET) - protected route should allow valid Bearer token', async () => {
      const privateKey = JwtUtil.readKeyFile('apps/auth/keys/private.key') || DEFAULT_DEV_EC_PRIVATE_KEY;

      const token = JwtUtil.sign(
         { sub: 'usr_mock_123', email: 'john@example.com', roles: [DEFAULT_ROLES.USER], tokenType: 'access' },
         privateKey,
         3600,
         { keyid: configService.jwtKeyId },
      );

      const res = await request(app.getHttpServer() as App)
         .get('/auth/me')
         .set('Authorization', `Bearer ${token}`)
         .expect(200);

      const body = res.body as { sub: string; email: string };
      expect(body.sub).toBe('usr_mock_123');
      expect(body.email).toBe('john@example.com');
   });

   it('/auth/me (GET) - mobile client should use Bearer token from response body', async () => {
      const privateKey = JwtUtil.readKeyFile('apps/auth/keys/private.key') || DEFAULT_DEV_EC_PRIVATE_KEY;

      const token = JwtUtil.sign(
         { sub: 'usr_mobile_456', email: 'mobile@example.com', roles: [DEFAULT_ROLES.USER], tokenType: 'access' },
         privateKey,
         3600,
         { keyid: configService.jwtKeyId },
      );

      const res = await request(app.getHttpServer() as App)
         .get('/auth/me')
         .set('Authorization', `Bearer ${token}`)
         .set('X-Client-Type', 'android')
         .expect(200);

      const body = res.body as { sub: string; email: string };
      expect(body.sub).toBe('usr_mobile_456');
      expect(body.email).toBe('mobile@example.com');
   });

   describe('Global RolesGuard and PermissionsGuard enforcement', () => {
      it('/users (GET) - should reject authenticated user without ADMIN role (403 Forbidden)', async () => {
         const privateKey = JwtUtil.readKeyFile('apps/auth/keys/private.key') || DEFAULT_DEV_EC_PRIVATE_KEY;

         const token = JwtUtil.sign(
            { sub: 'usr_normal_user', email: 'user@example.com', roles: [DEFAULT_ROLES.USER], tokenType: 'access' },
            privateKey,
            3600,
            { keyid: configService.jwtKeyId },
         );

         await request(app.getHttpServer() as App)
            .get('/users')
            .set('Authorization', `Bearer ${token}`)
            .expect(403);
      });
   });
});
