import { Test, TestingModule } from '@nestjs/testing';
import { SERVICES, UUID_V7_REGEX } from '@common';
import { AuthModule } from '@auth/auth.module';
import { AuthRegistrationService, AuthCoreService } from '@auth/services/domain';
import { PrismaService } from '@auth/prisma';

describe('AuthModule (e2e)', () => {
   let moduleFixture: TestingModule;
   let authRegistrationService: AuthRegistrationService;
   let authCoreService: AuthCoreService;
   let prismaService: PrismaService;

   let isDbConnected = false;

   beforeAll(async () => {
      moduleFixture = await Test.createTestingModule({
         imports: [AuthModule],
      })
         .overrideProvider(SERVICES.NOTIFICATION_SERVICE)
         .useValue({ emit: jest.fn(), send: jest.fn() })
         .compile();

      authRegistrationService = moduleFixture.get<AuthRegistrationService>(AuthRegistrationService);
      authCoreService = moduleFixture.get<AuthCoreService>(AuthCoreService);
      prismaService = moduleFixture.get<PrismaService>(PrismaService);

      try {
         await prismaService.$queryRaw`SELECT 1`;
         isDbConnected = true;
      } catch {
         isDbConnected = false;
      }
   });

   beforeEach(async () => {
      if (isDbConnected) {
         await prismaService.account.deleteMany({
            where: { email: 'e2e@example.com' },
         });
      }
   });

   afterAll(async () => {
      if (isDbConnected) {
         await prismaService.account.deleteMany({
            where: { email: 'e2e@example.com' },
         });
      }
      await moduleFixture.close();
   });

   it('should compile and register/login user with UUIDv7 ID', async () => {
      expect(authRegistrationService).toBeDefined();
      expect(authCoreService).toBeDefined();

      if (!isDbConnected) {
         return;
      }

      const user = await authRegistrationService.register({
         email: 'e2e@example.com',
         password: 'Password123!',
         confirmPassword: 'Password123!',
      });

      expect(user.user.email).toBe('e2e@example.com');
      expect(user.user.userId).toBeDefined();
      expect(UUID_V7_REGEX.test(user.user.userId)).toBe(true);
      expect(user.accessToken).toBeDefined();

      const validation = await authCoreService.validateToken(user.accessToken);
      expect(validation.valid).toBe(true);
      expect(validation.user.email).toBe('e2e@example.com');
   });
});
