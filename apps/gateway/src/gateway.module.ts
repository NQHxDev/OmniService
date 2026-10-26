import { Module } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { CustomThrottlerGuard, JwtAuthGuard, PermissionsGuard, RedisModule, RolesGuard } from '@common';
import { GatewayConfigModule, GatewayConfigService } from '@/config';
import { GatewayLoggerModule } from '@/logger';
import { AuditLogsModule } from '@/modules/audit-logs/audit-logs.module';
import { AuthModule } from '@/modules/auth/auth.module';
import { HealthModule } from '@/modules/health/health.module';
import { UsersModule } from '@/modules/users/users.module';
import { MediaModule } from '@/modules/media/media.module';
import { PostsModule } from '@/modules/posts/posts.module';
import { CommerceModule } from '@/modules/commerce/commerce.module';
import { SuppliersModule } from '@/modules/suppliers/suppliers.module';
import { OrdersModule } from '@/modules/orders/orders.module';
import { PaymentsModule } from '@/modules/payments/payments.module';
import { ProductsModule } from '@/modules/products/products.module';

@Module({
   imports: [
      GatewayConfigModule,
      GatewayLoggerModule,
      RedisModule,
      ThrottlerModule.forRootAsync({
         imports: [GatewayConfigModule],
         inject: [GatewayConfigService],
         useFactory: (config: GatewayConfigService) => [
            {
               name: 'short',
               ttl: config.throttle.shortTtl,
               limit: config.throttle.shortLimit,
            },
            {
               name: 'medium',
               ttl: config.throttle.mediumTtl,
               limit: config.throttle.mediumLimit,
            },
            {
               name: 'long',
               ttl: config.throttle.longTtl,
               limit: config.throttle.longLimit,
            },
         ],
      }),
      HealthModule,
      AuthModule,
      UsersModule,
      AuditLogsModule,
      MediaModule,
      PostsModule,
      CommerceModule,
      SuppliersModule,
      OrdersModule,
      PaymentsModule,
      ProductsModule,
   ],
   controllers: [],
   providers: [
      Reflector,
      {
         provide: APP_GUARD,
         useClass: CustomThrottlerGuard,
      },
      {
         provide: APP_GUARD,
         useClass: JwtAuthGuard,
      },
      {
         provide: APP_GUARD,
         useClass: RolesGuard,
      },
      {
         provide: APP_GUARD,
         useClass: PermissionsGuard,
      },
   ],
})
export class GatewayModule {}
