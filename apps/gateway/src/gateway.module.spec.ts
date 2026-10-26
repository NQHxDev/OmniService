import { APP_GUARD, Reflector } from '@nestjs/core';
import { CustomThrottlerGuard, JwtAuthGuard, PermissionsGuard, RolesGuard } from '@common';
import { GatewayModule } from '@/gateway.module';

describe('GatewayModule', () => {
   it('should be defined', () => {
      expect(GatewayModule).toBeDefined();
   });

   it('should register Reflector and global guards in the correct defense-in-depth order', () => {
      const providers = (Reflect.getMetadata('providers', GatewayModule) || []) as unknown[];

      expect(providers).toBeDefined();

      const appGuardProviders = providers.filter((p): p is { provide: unknown; useClass: unknown } =>
         Boolean(p && typeof p === 'object' && 'provide' in p && p.provide === APP_GUARD),
      );
      const guardClasses = appGuardProviders.map((p) => p.useClass);

      // Defense-in-depth security chain order:
      // 1. CustomThrottlerGuard - edge rate limiting
      // 2. JwtAuthGuard - authentication & token extraction
      // 3. RolesGuard - role-based access control (RBAC)
      // 4. PermissionsGuard - fine-grained permission-based access control (PBAC)
      expect(guardClasses).toEqual([CustomThrottlerGuard, JwtAuthGuard, RolesGuard, PermissionsGuard]);

      const hasReflector = providers.some(
         (p) => p === Reflector || (typeof p === 'object' && p !== null && 'provide' in p && p.provide === Reflector),
      );
      expect(hasReflector).toBe(true);
   });
});
