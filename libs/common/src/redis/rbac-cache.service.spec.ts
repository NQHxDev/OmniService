import { ClientProxy } from '@nestjs/microservices';
import { of, throwError } from 'rxjs';
import { RbacRedisKeys } from '@common/constants';
import { CachedRoleData, RbacCacheService } from '@common/redis/rbac-cache.service';
import { RedisService } from '@common/redis/redis.service';
import { RBAC_INTERNAL_PATTERNS } from '@common/rmq/rmq.constants';

describe('RbacCacheService', () => {
   let service: RbacCacheService;
   const mockGet = jest.fn();
   const mockSet = jest.fn();
   const mockDel = jest.fn();
   const mockGetJson = jest.fn();
   const mockSetJson = jest.fn();
   const mockAuthClientSend = jest.fn();

   beforeEach(() => {
      jest.clearAllMocks();

      const mockRedisService = {
         get: mockGet,
         set: mockSet,
         del: mockDel,
         getJson: mockGetJson,
         setJson: mockSetJson,
      } as unknown as RedisService;

      const mockAuthClient = {
         send: mockAuthClientSend,
      } as unknown as ClientProxy;

      service = new RbacCacheService(mockRedisService, undefined, mockAuthClient);
   });

   it('should get role from Redis by key', async () => {
      const mockRole: CachedRoleData = {
         roleId: 'role-1',
         code: 'USER',
         name: 'Standard User',
         description: 'desc',
         permissions: ['USERS:READ'],
      };
      mockGetJson.mockResolvedValue(mockRole);

      const result = await service.getRole('USER');
      expect(mockGetJson).toHaveBeenCalledWith(RbacRedisKeys.role('USER'));
      expect(result).toEqual(mockRole);
   });

   it('should normalize legacy id to roleId if roleId is missing', async () => {
      const legacyMockRole = {
         id: 'role-legacy-1',
         code: 'USER',
         name: 'Standard User',
         description: 'desc',
         permissions: ['USERS:READ'],
      };
      mockGetJson.mockResolvedValue(legacyMockRole);

      const result = await service.getRole('USER');
      expect(result?.roleId).toBe('role-legacy-1');
   });

   it('should set role and permissions in Redis', async () => {
      const roleData: CachedRoleData = {
         roleId: 'role-1',
         code: 'USER',
         name: 'Standard User',
         description: 'desc',
         permissions: ['USERS:READ'],
      };

      await service.setRole('USER', roleData);
      expect(mockSetJson).toHaveBeenCalledWith(RbacRedisKeys.role('USER'), roleData, expect.any(Number));
      expect(mockSetJson).toHaveBeenCalledWith(
         RbacRedisKeys.rolePermissions('USER'),
         roleData.permissions,
         expect.any(Number),
      );
   });

   it('should get role permissions from permissions key if available', async () => {
      mockGetJson.mockResolvedValue(['USERS:READ', 'USERS:UPDATE']);

      const perms = await service.getRolePermissions('USER');
      expect(mockGetJson).toHaveBeenCalledWith(RbacRedisKeys.rolePermissions('USER'));
      expect(perms).toEqual(['USERS:READ', 'USERS:UPDATE']);
   });

   it('should fallback to authClient RPC when cache misses and authClient is available', async () => {
      mockGetJson.mockResolvedValue(null);
      mockAuthClientSend.mockReturnValue(of(['USERS:READ', 'USERS:CREATE']));

      const perms = await service.getRolePermissions('USER');
      expect(mockAuthClientSend).toHaveBeenCalledWith(
         { cmd: RBAC_INTERNAL_PATTERNS.GET_ROLE_PERMISSIONS },
         { roleCode: 'USER' },
      );
      expect(perms).toEqual(['USERS:READ', 'USERS:CREATE']);
   });

   it('should return null if authClient RPC throws error', async () => {
      mockGetJson.mockResolvedValue(null);
      mockAuthClientSend.mockReturnValue(throwError(() => new Error('RPC error')));

      const perms = await service.getRolePermissions('USER');
      expect(perms).toBeNull();
   });

   it('should invalidate role and permissions keys', async () => {
      await service.invalidateRole('USER');
      expect(mockDel).toHaveBeenCalledWith(RbacRedisKeys.role('USER'));
      expect(mockDel).toHaveBeenCalledWith(RbacRedisKeys.rolePermissions('USER'));
   });
});
