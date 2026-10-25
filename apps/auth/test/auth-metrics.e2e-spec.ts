import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthModule } from '@auth/auth.module';

describe('Metrics Endpoint (e2e)', () => {
   let app: ReturnType<TestingModule['createNestApplication']>;

   beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({
         imports: [AuthModule],
      }).compile();

      app = moduleRef.createNestApplication();
      await app.init();
   });

   afterAll(async () => {
      await app.close();
   });

   it('/metrics (GET) should return Prometheus format', async () => {
      const res = await request(app.getHttpServer() as App)
         .get('/metrics')
         .expect(200)
         .expect('Content-Type', /text\/plain/);

      expect(res.text).toContain('# HELP');
      expect(res.text).toContain('# TYPE');
      expect(res.text).toContain('auth_');
   });

   it('/metrics (GET) should include all expected metric names', async () => {
      const res = await request(app.getHttpServer() as App)
         .get('/metrics')
         .expect(200);

      expect(res.text).toContain('auth_login_attempts_total');
      expect(res.text).toContain('auth_token_operations_total');
      expect(res.text).toContain('auth_login_duration_seconds');
   });
});
