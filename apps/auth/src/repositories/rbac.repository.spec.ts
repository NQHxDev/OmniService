import { Test, TestingModule } from '@nestjs/testing';
import { DEFAULT_ROLES } from '@common';
import { PrismaService } from '@auth/prisma/prisma.service';
import { RbacRepository } from '@auth/repositories/rbac.repository';

describe('RbacRepository', () => {
   let repository: RbacRepository;
   let prismaService: {
      role: {
         findFirst: jest.Mock;
         create: jest.Mock;
      };
      rolePermission: {
         findMany: jest.Mock;
      };
      accountRole: {
         upsert: jest.Mock;
         deleteMany: jest.Mock;
         findMany: jest.Mock;
      };
   };

   beforeEach(async () => {
      prismaService = {
         role: {
            findFirst: jest.fn(),
            create: jest.fn(),
         },
         rolePermission: {
            findMany: jest.fn(),
         },
         accountRole: {
            upsert: jest.fn(),
            deleteMany: jest.fn(),
            findMany: jest.fn(),
         },
      };

      const module: TestingModule = await Test.createTestingModule({
         providers: [
            RbacRepository,
            {
               provide: PrismaService,
               useValue: prismaService,
            },
         ],
      }).compile();

      repository = module.get<RbacRepository>(RbacRepository);
   });

   it('should be defined', () => {
      expect(repository).toBeDefined();
   });

   it('should find role by code with permissions', async () => {
      prismaService.role.findFirst.mockResolvedValue({
         roleId: 'role-1',
         code: 'ADMIN',
         name: 'Administrator',
         description: 'Admin role',
         version: 1,
         deletedAt: null,
         createdAt: new Date('2026-09-27T00:00:00.000Z'),
         updatedAt: new Date('2026-09-27T00:00:00.000Z'),
         rolePermissions: [
            {
               permission: {
                  permissionId: 'perm-1',
                  code: 'USERS:READ',
                  name: 'Read Users',
                  description: null,
                  version: 1,
                  deletedAt: null,
                  createdAt: new Date('2026-09-27T00:00:00.000Z'),
                  updatedAt: new Date('2026-09-27T00:00:00.000Z'),
               },
            },
         ],
      });

      const role = await repository.findRoleByCode('ADMIN');
      expect(role).toBeDefined();
      expect(role?.roleId).toBe('role-1');
      expect(role?.code).toBe('ADMIN');
      expect(role?.permissions).toEqual(['USERS:READ']);
   });

   it('should return null when role code not found', async () => {
      prismaService.role.findFirst.mockResolvedValue(null);
      const role = await repository.findRoleByCode('NOT_FOUND');
      expect(role).toBeNull();
   });

   it('should find role by id', async () => {
      prismaService.role.findFirst.mockResolvedValue({
         roleId: 'role-1',
         code: DEFAULT_ROLES.USER,
         name: 'User',
         description: null,
         version: 1,
         deletedAt: null,
         createdAt: new Date('2026-09-27T00:00:00.000Z'),
         updatedAt: new Date('2026-09-27T00:00:00.000Z'),
         rolePermissions: [],
      });

      const role = await repository.findRoleById('role-1');
      expect(role).toBeDefined();
      expect(role?.roleId).toBe('role-1');
   });

   it('should find permissions by role id', async () => {
      prismaService.rolePermission.findMany.mockResolvedValue([
         {
            permission: {
               permissionId: 'perm-1',
               code: 'AUTH:LOGIN',
               name: 'Login',
               description: null,
               version: 1,
               deletedAt: null,
               createdAt: new Date('2026-09-27T00:00:00.000Z'),
               updatedAt: new Date('2026-09-27T00:00:00.000Z'),
            },
         },
      ]);

      const perms = await repository.findPermissionsByRoleId('role-1');
      expect(perms).toHaveLength(1);
      expect(perms[0].code).toBe('AUTH:LOGIN');
   });

   it('should assign role to account', async () => {
      prismaService.accountRole.upsert.mockResolvedValue({});
      await repository.assignRoleToAccount('acc-1', 'role-1');
      expect(prismaService.accountRole.upsert).toHaveBeenCalledWith({
         where: {
            accountId_roleId: {
               accountId: 'acc-1',
               roleId: 'role-1',
            },
         },
         update: {},
         create: {
            accountId: 'acc-1',
            roleId: 'role-1',
         },
      });
   });

   it('should remove role from account', async () => {
      prismaService.accountRole.deleteMany.mockResolvedValue({});
      await repository.removeRoleFromAccount('acc-1', 'role-1');
      expect(prismaService.accountRole.deleteMany).toHaveBeenCalledWith({
         where: {
            accountId: 'acc-1',
            roleId: 'role-1',
         },
      });
   });

   it('should get account roles', async () => {
      prismaService.accountRole.findMany.mockResolvedValue([
         {
            role: {
               roleId: 'role-1',
               code: DEFAULT_ROLES.USER,
               name: 'User',
               description: null,
               version: 1,
               deletedAt: null,
               createdAt: new Date('2026-09-27T00:00:00.000Z'),
               updatedAt: new Date('2026-09-27T00:00:00.000Z'),
               rolePermissions: [],
            },
         },
      ]);

      const roles = await repository.getAccountRoles('acc-1');
      expect(roles).toHaveLength(1);
      expect(roles[0].code).toBe(DEFAULT_ROLES.USER);
   });

   it('should create a role and return RoleEntity', async () => {
      const mockRoleData = {
         code: 'MODERATOR',
         name: 'Content Moderator',
         description: 'Role for moderating community content',
      };

      prismaService.role.create.mockResolvedValue({
         roleId: 'role-mod-1',
         code: mockRoleData.code,
         name: mockRoleData.name,
         description: mockRoleData.description,
         version: 1,
         deletedAt: null,
         createdAt: new Date('2026-10-24T00:00:00.000Z'),
         updatedAt: new Date('2026-10-24T00:00:00.000Z'),
         rolePermissions: [],
      });

      const role = await repository.createRole(mockRoleData);
      expect(role).toBeDefined();
      expect(role.code).toBe(mockRoleData.code);
      expect(prismaService.role.create).toHaveBeenCalledWith(
         expect.objectContaining({
            data: expect.objectContaining({ code: mockRoleData.code }),
         }),
      );
   });
});
