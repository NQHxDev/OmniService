import { Test, TestingModule } from '@nestjs/testing';
import { DEFAULT_ROLES, UUID_V7_REGEX } from '@common';
import { USER_STATUS } from '@contracts/auth';
import { PrismaService } from '@auth/prisma/prisma.service';
import { AccountRepository } from '@auth/repositories/account.repository';

describe('AccountRepository', () => {
   let repository: AccountRepository;
   let prismaService: {
      account: {
         findFirst: jest.Mock;
         findMany: jest.Mock;
         create: jest.Mock;
         update: jest.Mock;
         delete: jest.Mock;
      };
   };

   beforeEach(async () => {
      prismaService = {
         account: {
            findFirst: jest.fn(),
            findMany: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
         },
      };

      const module: TestingModule = await Test.createTestingModule({
         providers: [
            AccountRepository,
            {
               provide: PrismaService,
               useValue: prismaService,
            },
         ],
      }).compile();

      repository = module.get<AccountRepository>(AccountRepository);
   });

   it('should be defined', () => {
      expect(repository).toBeDefined();
   });

   it('should create an account with a valid UUIDv7 id and return mapped entity', async () => {
      prismaService.account.create.mockImplementation(
         ({ data }: { data: { accountId: string; email: string; passwordHash: string; createdAt?: Date } }) =>
            Promise.resolve({
               accountId: data.accountId,
               email: data.email,
               phoneNumber: null,
               passwordHash: data.passwordHash,
               status: 'ACTIVE',
               isEmailVerified: false,
               lastLoginAt: null,
               version: 1,
               deletedAt: null,
               createdAt: new Date('2026-09-27T00:00:00.000Z'),
               updatedAt: new Date('2026-09-27T00:00:00.000Z'),
               accountRoles: [],
            }),
      );

      const user = await repository.create({
         email: 'test@example.com',
         passwordHash: 'hashed_password',
      });

      expect(user).toBeDefined();
      expect(user.accountId).toBeDefined();
      expect(UUID_V7_REGEX.test(user.accountId)).toBe(true);
      expect(user.email).toBe('test@example.com');
      expect(user.status).toBe('ACTIVE');
      expect(user.isEmailVerified).toBe(false);
      expect(user.version).toBe(1);
      expect(prismaService.account.create).toHaveBeenCalledTimes(1);
   });

   it('should return list of all active account emails', async () => {
      prismaService.account.findMany.mockResolvedValue([
         { email: 'user1@example.com' },
         { email: 'user2@example.com' },
      ]);

      const emails = await repository.findAllEmails();

      expect(prismaService.account.findMany).toHaveBeenCalledWith({
         where: { deletedAt: null },
         select: { email: true },
      });
      expect(emails).toEqual(['user1@example.com', 'user2@example.com']);
   });

   it('should find account by email with case-insensitivity and deletedAt null check', async () => {
      prismaService.account.findFirst.mockResolvedValue({
         accountId: 'test-id',
         email: 'user@example.com',
         phoneNumber: null,
         passwordHash: 'hash',
         status: USER_STATUS.ACTIVE,
         isEmailVerified: true,
         lastLoginAt: new Date('2026-09-27T01:00:00.000Z'),
         version: 1,
         deletedAt: null,
         createdAt: new Date('2026-09-27T00:00:00.000Z'),
         updatedAt: new Date('2026-09-27T00:00:00.000Z'),
         accountRoles: [
            {
               role: {
                  roleId: 'role-1',
                  code: DEFAULT_ROLES.USER,
                  name: 'User',
                  description: 'Standard user',
                  version: 1,
                  deletedAt: null,
                  createdAt: new Date('2026-09-27T00:00:00.000Z'),
                  updatedAt: new Date('2026-09-27T00:00:00.000Z'),
               },
            },
         ],
      });

      const found = await repository.findByEmail('USER@EXAMPLE.COM');
      expect(prismaService.account.findFirst).toHaveBeenCalledWith({
         where: {
            email: 'user@example.com',
            deletedAt: null,
         },
         include: {
            accountRoles: {
               include: {
                  role: true,
               },
            },
         },
      });
      expect(found).toBeDefined();
      expect(found?.email).toBe('user@example.com');
      expect(found?.status).toBe(USER_STATUS.ACTIVE);
      expect(found?.isEmailVerified).toBe(true);
      expect(found?.lastLoginAt).toBe('2026-09-27T01:00:00.000Z');
      expect(found?.roles).toEqual([DEFAULT_ROLES.USER]);
   });

   it('should return null when finding account by email if soft deleted', async () => {
      prismaService.account.findFirst.mockResolvedValue(null);

      const found = await repository.findByEmail('deleted@example.com');
      expect(prismaService.account.findFirst).toHaveBeenCalledWith({
         where: {
            email: 'deleted@example.com',
            deletedAt: null,
         },
         include: {
            accountRoles: {
               include: {
                  role: true,
               },
            },
         },
      });
      expect(found).toBeNull();
   });

   it('should find account by id filtering deletedAt null', async () => {
      prismaService.account.findFirst.mockResolvedValue({
         accountId: 'user-id-123',
         email: 'user2@example.com',
         phoneNumber: null,
         passwordHash: 'hash',
         status: 'ACTIVE',
         isEmailVerified: false,
         lastLoginAt: null,
         version: 1,
         deletedAt: null,
         createdAt: new Date('2026-09-27T00:00:00.000Z'),
         updatedAt: new Date('2026-09-27T00:00:00.000Z'),
         accountRoles: [],
      });

      const found = await repository.findById('user-id-123');
      expect(prismaService.account.findFirst).toHaveBeenCalledWith({
         where: {
            accountId: 'user-id-123',
            deletedAt: null,
         },
         include: {
            accountRoles: {
               include: {
                  role: true,
               },
            },
         },
      });
      expect(found).toBeDefined();
      expect(found?.accountId).toBe('user-id-123');
      expect(found?.roles).toEqual([]);
   });

   it('should update account and return updated entity', async () => {
      prismaService.account.update.mockResolvedValue({
         accountId: 'acc-1',
         email: 'updated@example.com',
         phoneNumber: null,
         passwordHash: 'new-hash',
         status: 'ACTIVE',
         isEmailVerified: true,
         lastLoginAt: null,
         version: 2,
         deletedAt: null,
         createdAt: new Date('2026-09-27T00:00:00.000Z'),
         updatedAt: new Date('2026-09-27T01:00:00.000Z'),
         accountRoles: [],
      });

      const updated = await repository.update('acc-1', { passwordHash: 'new-hash' });
      expect(updated).toBeDefined();
      expect(updated?.passwordHash).toBe('new-hash');
   });

   it('should return null when updating account fails', async () => {
      prismaService.account.update.mockRejectedValue(new Error('Record not found'));
      const updated = await repository.update('non-existent', { passwordHash: 'new-hash' });
      expect(updated).toBeNull();
   });

   it('should soft delete account', async () => {
      prismaService.account.update.mockResolvedValue({});
      const result = await repository.softDelete('acc-1');
      expect(result).toBe(true);
      expect(prismaService.account.update).toHaveBeenCalledWith(
         expect.objectContaining({
            where: { accountId: 'acc-1' },
            data: expect.objectContaining({ deletedAt: expect.any(Date) as unknown }) as unknown,
         }) as unknown,
      );
   });

   it('should delete account', async () => {
      prismaService.account.delete.mockResolvedValue({});
      const result = await repository.delete('acc-1');
      expect(result).toBe(true);
      expect(prismaService.account.delete).toHaveBeenCalledWith({
         where: { accountId: 'acc-1' },
      });
   });
});
