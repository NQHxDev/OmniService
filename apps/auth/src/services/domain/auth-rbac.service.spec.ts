import { Test, TestingModule } from '@nestjs/testing';
import { DEFAULT_ROLES, RbacCacheService, SYSTEM_ROLES } from '@common';
import { RBAC_REPOSITORY } from '@auth/repositories';
import { AuthRbacService } from '@auth/services/domain/auth-rbac.service';

describe('AuthRbacService', () => {
   let service: AuthRbacService;

   const mockRbacRepository = {
      findRoleByCode: jest.fn(),
      createRole: jest.fn(),
      assignRoleToAccount: jest.fn(),
   };

   const mockRbacCacheService = {
      getRole: jest.fn(),
      setRole: jest.fn(),
      invalidateRole: jest.fn(),
   };

   beforeEach(async () => {
      jest.clearAllMocks();

      const module: TestingModule = await Test.createTestingModule({
         providers: [
            AuthRbacService,
            {
               provide: RBAC_REPOSITORY,
               useValue: mockRbacRepository,
            },
            {
               provide: RbacCacheService,
               useValue: mockRbacCacheService,
            },
         ],
      }).compile();

      service = module.get<AuthRbacService>(AuthRbacService);
   });

   it('should be defined', () => {
      expect(service).toBeDefined();
   });

   describe('getOrCacheRole', () => {
      it('should return cached role if present in cache', async () => {
         const cachedRole = { id: 'role-1', code: DEFAULT_ROLES.USER, name: 'User', permissions: ['read'] };
         mockRbacCacheService.getRole.mockResolvedValueOnce(cachedRole);

         const result = await service.getOrCacheRole(DEFAULT_ROLES.USER);

         expect(result).toEqual(cachedRole);
         expect(mockRbacCacheService.getRole).toHaveBeenCalledWith(DEFAULT_ROLES.USER);
         expect(mockRbacRepository.findRoleByCode).not.toHaveBeenCalled();
      });

      it('should fetch from repository and cache role if not in cache', async () => {
         const repoRole = {
            roleId: 'role-1',
            code: DEFAULT_ROLES.USER,
            name: 'User',
            description: 'User role',
            permissions: ['read'],
         };
         mockRbacCacheService.getRole.mockResolvedValueOnce(null);
         mockRbacRepository.findRoleByCode.mockResolvedValueOnce(repoRole);

         const result = await service.getOrCacheRole(DEFAULT_ROLES.USER);

         expect(result).toEqual(repoRole);
         expect(mockRbacRepository.findRoleByCode).toHaveBeenCalledWith(DEFAULT_ROLES.USER);
         expect(mockRbacCacheService.setRole).toHaveBeenCalledWith(DEFAULT_ROLES.USER, {
            roleId: 'role-1',
            code: DEFAULT_ROLES.USER,
            name: 'User',
            description: 'User role',
            permissions: ['read'],
         });
      });

      it('should return null if role not found in repo', async () => {
         mockRbacCacheService.getRole.mockResolvedValueOnce(null);
         mockRbacRepository.findRoleByCode.mockResolvedValueOnce(null);

         const result = await service.getOrCacheRole('UNKNOWN');

         expect(result).toBeNull();
         expect(mockRbacCacheService.setRole).not.toHaveBeenCalled();
      });
   });

   describe('getRolePermissions', () => {
      it('should return role permissions', async () => {
         mockRbacCacheService.getRole.mockResolvedValueOnce({
            roleId: 'r1',
            id: 'r1',
            permissions: ['read:auth', 'write:auth'],
         });

         const permissions = await service.getRolePermissions(DEFAULT_ROLES.ADMIN);

         expect(permissions).toEqual(['read:auth', 'write:auth']);
      });

      it('should return empty array if role has no permissions or does not exist', async () => {
         mockRbacCacheService.getRole.mockResolvedValueOnce(null);
         mockRbacRepository.findRoleByCode.mockResolvedValueOnce(null);

         const permissions = await service.getRolePermissions('NON_EXISTENT');

         expect(permissions).toEqual([]);
      });
   });

   describe('assignRoleToAccount', () => {
      it('should assign existing role to account and invalidate role cache', async () => {
         mockRbacRepository.findRoleByCode.mockResolvedValueOnce({
            roleId: 'role-123',
            code: SYSTEM_ROLES.SUPER_ADMIN,
         });

         await service.assignRoleToAccount('acc-1', SYSTEM_ROLES.SUPER_ADMIN);

         expect(mockRbacRepository.assignRoleToAccount).toHaveBeenCalledWith('acc-1', 'role-123');
         expect(mockRbacCacheService.invalidateRole).toHaveBeenCalledWith(SYSTEM_ROLES.SUPER_ADMIN);
         expect(mockRbacRepository.createRole).not.toHaveBeenCalled();
      });

      it('should dynamically create role if not present, then assign and invalidate cache', async () => {
         mockRbacRepository.findRoleByCode.mockResolvedValueOnce(null);
         mockRbacRepository.createRole.mockResolvedValueOnce({
            roleId: 'role-new',
            code: SYSTEM_ROLES.SUPER_ADMIN,
         });

         await service.assignRoleToAccount('acc-2', SYSTEM_ROLES.SUPER_ADMIN);

         expect(mockRbacRepository.createRole).toHaveBeenCalledWith(
            expect.objectContaining({ code: SYSTEM_ROLES.SUPER_ADMIN }),
         );
         expect(mockRbacRepository.assignRoleToAccount).toHaveBeenCalledWith('acc-2', 'role-new');
         expect(mockRbacCacheService.invalidateRole).toHaveBeenCalledWith(SYSTEM_ROLES.SUPER_ADMIN);
      });
   });
});
