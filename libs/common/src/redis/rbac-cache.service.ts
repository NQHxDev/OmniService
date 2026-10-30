import { Inject, Injectable, Optional } from '@nestjs/common';
import type { ClientGrpc, ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, Observable, timeout } from 'rxjs';
import { RbacRedisKeys, RBAC_REDIS_TTL } from '@common/constants/redis.constant';
import { GRPC_CLIENTS, GRPC_SERVICE_NAMES } from '@common/constants/services.constant';
import { RedisService } from '@common/redis/redis.service';
import { RBAC_INTERNAL_PATTERNS, SERVICES } from '@common/rmq/rmq.constants';

export interface CachedRoleData {
   roleId: string;
   code: string;
   name: string;
   description?: string | null;
   permissions: string[];
}

@Injectable()
export class RbacCacheService {
   constructor(
      private readonly redisService: RedisService,
      @Optional()
      @Inject(GRPC_CLIENTS.AUTH_V1)
      private readonly authGrpcClient?: ClientGrpc,
      @Optional()
      @Inject(SERVICES.AUTH_SERVICE)
      private readonly authClient?: ClientProxy,
   ) {}

   async getRole(roleCode: string): Promise<CachedRoleData | null> {
      const key = RbacRedisKeys.role(roleCode);
      const data = await this.redisService.getJson<CachedRoleData & { id?: string }>(key);
      if (!data) {
         return null;
      }
      if (!data.roleId && data.id) {
         data.roleId = data.id;
      }
      return data;
   }

   async setRole(
      roleCode: string,
      roleData: CachedRoleData,
      ttlSeconds: number = RBAC_REDIS_TTL.DEFAULT_ROLE,
   ): Promise<void> {
      const roleKey = RbacRedisKeys.role(roleCode);
      const permissionsKey = RbacRedisKeys.rolePermissions(roleCode);

      await Promise.all([
         this.redisService.setJson(roleKey, roleData, ttlSeconds),
         this.redisService.setJson(permissionsKey, roleData.permissions, ttlSeconds),
      ]);
   }

   async getRolePermissions(roleCode: string): Promise<string[] | null> {
      const permissionsKey = RbacRedisKeys.rolePermissions(roleCode);
      const cachedPermissions = await this.redisService.getJson<string[]>(permissionsKey);
      if (cachedPermissions) {
         return cachedPermissions;
      }

      const roleData = await this.getRole(roleCode);
      if (roleData && roleData.permissions) {
         return roleData.permissions;
      }

      // Fallback via Auth Service gRPC when Redis cache misses
      if (this.authGrpcClient) {
         try {
            const service = this.authGrpcClient.getService<{
               getRolePermissions(data: { roleCode: string }): Observable<{ permissions: string[] }>;
            }>(GRPC_SERVICE_NAMES.AUTH);
            const res = await firstValueFrom(service.getRolePermissions({ roleCode }).pipe(timeout(5000)));
            if (res?.permissions) {
               return res.permissions;
            }
         } catch {
            // continue to fallback
         }
      }

      // Fallback via Auth Service RMQ if gRPC unavailable
      if (this.authClient) {
         try {
            const permissions = await firstValueFrom(
               this.authClient
                  .send<string[], { roleCode: string }>(
                     { cmd: RBAC_INTERNAL_PATTERNS.GET_ROLE_PERMISSIONS },
                     { roleCode },
                  )
                  .pipe(timeout(5000)),
            );
            return permissions ?? null;
         } catch {
            return null;
         }
      }

      return null;
   }

   async setRolePermissions(
      roleCode: string,
      permissions: string[],
      ttlSeconds: number = RBAC_REDIS_TTL.ROLE_PERMISSIONS,
   ): Promise<void> {
      const permissionsKey = RbacRedisKeys.rolePermissions(roleCode);
      await this.redisService.setJson(permissionsKey, permissions, ttlSeconds);
   }

   async invalidateRole(roleCode: string): Promise<void> {
      const roleKey = RbacRedisKeys.role(roleCode);
      const permissionsKey = RbacRedisKeys.rolePermissions(roleCode);

      await Promise.all([this.redisService.del(roleKey), this.redisService.del(permissionsKey)]);
   }
}
