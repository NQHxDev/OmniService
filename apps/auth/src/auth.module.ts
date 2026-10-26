import { Module, type OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import {
   COMMAND_BUS,
   CommandBus,
   DatabaseHealthIndicator,
   GRPC_METRICS_COLLECTOR,
   GrpcHealthModule,
   GrpcLoggingInterceptor,
   GrpcMetricsInterceptor,
   HEALTH_INDICATOR_NAMES,
   RedisHealthIndicator,
   RedisModule,
   RedisService,
   RmqModule,
   SERVICES,
   SagaModule,
   type ICommandHandler,
} from '@common';
import { PrismaService } from '@auth/prisma';
import { AuthController } from '@auth/auth.controller';
import { AuthConfigModule } from '@auth/config';
import { AuthLoggerModule } from '@auth/logger';
import { OutboxModule } from '@auth/outbox';
import { PrismaModule } from '@auth/prisma';
import { UnitOfWorkModule } from '@auth/unit-of-work';
import { AUTH_COMMAND_HANDLERS } from '@auth/commands';
import { NOTIFICATION_ADAPTER, RabbitMqNotificationAdapter, AuthGrpcController } from '@auth/adapters';
import {
   ACCOUNT_REPOSITORY,
   AccountRepository,
   AUDIT_LOG_REPOSITORY,
   AuditLogRepository,
   RBAC_REPOSITORY,
   RbacRepository,
   SESSION_REPOSITORY,
   SessionRepository,
   PrismaSagaRepository,
} from '@auth/repositories';
import {
   AUTH_METRICS_SERVICE,
   AUTH_RATE_LIMITER,
   AuthMetricsService,
   AuthRateLimiter,
   AuditLogService,
   EmailBloomFilterService,
   JWT_SERVICE,
   JwtService,
   PASSWORD_HASHER,
   PasswordHasherService,
   TOKEN_LIFECYCLE_SERVICE,
   TokenLifecycleService,
   VERIFICATION_TOKEN_SERVICE,
   VerificationTokenService,
   AccountSweeperService,
} from '@auth/services/infrastructure';
import { AuthMetricsController } from '@auth/auth-metrics.controller';
import {
   AuthCoreService,
   AuthRegistrationService,
   PasswordManagementService,
   SessionManagementService,
   AuthRbacService,
   AuthAccountService,
   AuthLoginService,
   AuthTokenService,
} from '@auth/services/domain';
import {
   UserRegisteredEventHandler,
   AccountLockedEventHandler,
   PasswordChangedEventHandler,
   SessionRevokedEventHandler,
   AuthMetricsHandler,
} from '@auth/domain/event-handlers';
import { MetricsTokenLifecycleDecorator, MetricsPasswordHasherDecorator } from '@auth/decorators';
import {
   AccountNotBlockedSpecification,
   AccountActiveSpecification,
   AccountCanAuthenticateSpecification,
   PasswordMustChangeSpecification,
   SessionBelongsToAccountSpecification,
} from '@auth/domain/specifications';
import {
   LoginValidationPipeline,
   RateLimitHandler,
   LockoutHandler,
   AccountLookupHandler,
   PasswordVerificationHandler,
   AccountStatusHandler,
} from '@auth/chains/login-validation';
import {
   AUDIT_EVENT_STORE,
   AuditEventStore,
   SecurityAuditLogProjection,
   AccountSecurityScoreProjection,
   ThreatDetectionMetricsProjection,
   AuditProjectionRebuildService,
} from '@auth/cqrs';

@Module({
   imports: [
      EventEmitterModule.forRoot({
         wildcard: true,
         delimiter: '.',
         maxListeners: 20,
      }),
      AuthConfigModule,
      AuthLoggerModule,
      PrismaModule,
      RedisModule,
      GrpcHealthModule.registerAsync({
         imports: [PrismaModule, RedisModule],
         inject: [PrismaService, RedisService],
         useFactory: (prisma: PrismaService, redisService: RedisService) => [
            DatabaseHealthIndicator.fromPrisma(prisma, HEALTH_INDICATOR_NAMES.DATABASE),
            new RedisHealthIndicator(redisService, HEALTH_INDICATOR_NAMES.REDIS),
         ],
      }),
      OutboxModule,
      UnitOfWorkModule,
      RmqModule.register({
         name: SERVICES.NOTIFICATION_SERVICE,
      }),
      SagaModule.forRoot({
         repository: PrismaSagaRepository,
         enableRecoveryWorker: true,
      }),
   ],
   controllers: [AuthController, AuthMetricsController, AuthGrpcController],
   providers: [
      // Domain Event Handlers
      UserRegisteredEventHandler,
      AccountLockedEventHandler,
      PasswordChangedEventHandler,
      SessionRevokedEventHandler,

      // Domain Specifications
      AccountNotBlockedSpecification,
      AccountActiveSpecification,
      AccountCanAuthenticateSpecification,
      PasswordMustChangeSpecification,
      SessionBelongsToAccountSpecification,

      // Domain Services
      AuthCoreService,
      AuthRegistrationService,
      SessionManagementService,
      PasswordManagementService,
      AuthRbacService,
      AuthAccountService,
      AuthLoginService,
      AuthTokenService,

      // Login Validation Chain Handlers & Pipeline
      RateLimitHandler,
      LockoutHandler,
      AccountLookupHandler,
      PasswordVerificationHandler,
      AccountStatusHandler,
      LoginValidationPipeline,

      // Infrastructure Services - Split Token Services
      JwtService,
      {
         provide: JWT_SERVICE,
         useExisting: JwtService,
      },
      VerificationTokenService,
      {
         provide: VERIFICATION_TOKEN_SERVICE,
         useExisting: VerificationTokenService,
      },
      TokenLifecycleService,
      {
         provide: TOKEN_LIFECYCLE_SERVICE,
         useFactory: (inner: TokenLifecycleService, metricsService: AuthMetricsService) =>
            new MetricsTokenLifecycleDecorator(inner, metricsService),
         inject: [TokenLifecycleService, AUTH_METRICS_SERVICE],
      },
      AuthRateLimiter,
      {
         provide: AUTH_RATE_LIMITER,
         useExisting: AuthRateLimiter,
      },
      AuthMetricsService,
      {
         provide: AUTH_METRICS_SERVICE,
         useExisting: AuthMetricsService,
      },
      {
         provide: GRPC_METRICS_COLLECTOR,
         useExisting: AUTH_METRICS_SERVICE,
      },
      GrpcLoggingInterceptor,
      GrpcMetricsInterceptor,
      PasswordHasherService,
      {
         provide: PASSWORD_HASHER,
         useFactory: (inner: PasswordHasherService, metricsService: AuthMetricsService) =>
            new MetricsPasswordHasherDecorator(inner, metricsService),
         inject: [PasswordHasherService, AUTH_METRICS_SERVICE],
      },
      AuthMetricsHandler,
      AuditLogService,
      EmailBloomFilterService,

      // Notification Adapter
      RabbitMqNotificationAdapter,
      {
         provide: NOTIFICATION_ADAPTER,
         useClass: RabbitMqNotificationAdapter,
      },

      // CQRS Audit Log Components
      AuditEventStore,
      {
         provide: AUDIT_EVENT_STORE,
         useExisting: AuditEventStore,
      },
      SecurityAuditLogProjection,
      AccountSecurityScoreProjection,
      ThreatDetectionMetricsProjection,
      AuditProjectionRebuildService,

      // Repositories
      {
         provide: ACCOUNT_REPOSITORY,
         useClass: AccountRepository,
      },
      AccountRepository,
      {
         provide: RBAC_REPOSITORY,
         useClass: RbacRepository,
      },
      RbacRepository,
      {
         provide: SESSION_REPOSITORY,
         useClass: SessionRepository,
      },
      SessionRepository,
      {
         provide: AUDIT_LOG_REPOSITORY,
         useClass: AuditLogRepository,
      },
      AuditLogRepository,

      // Command Bus & Handlers
      CommandBus,
      {
         provide: COMMAND_BUS,
         useExisting: CommandBus,
      },
      ...AUTH_COMMAND_HANDLERS,
      AccountSweeperService,
   ],
   exports: [
      AuthCoreService,
      AuthRegistrationService,
      SessionManagementService,
      PasswordManagementService,
      AuthRbacService,
      AuthAccountService,
      AuthLoginService,
      AuthTokenService,
      LoginValidationPipeline,
      JWT_SERVICE,
      JwtService,
      AccountSweeperService,
      PASSWORD_HASHER,
      PasswordHasherService,
      VERIFICATION_TOKEN_SERVICE,
      VerificationTokenService,
      TOKEN_LIFECYCLE_SERVICE,
      TokenLifecycleService,
      AUTH_RATE_LIMITER,
      AuthRateLimiter,
      AUTH_METRICS_SERVICE,
      AuthMetricsService,
      AuditLogService,
      EmailBloomFilterService,
      ACCOUNT_REPOSITORY,
      AccountRepository,
      RBAC_REPOSITORY,
      RbacRepository,
      SESSION_REPOSITORY,
      SessionRepository,
      AUDIT_LOG_REPOSITORY,
      AuditLogRepository,
      AUDIT_EVENT_STORE,
      AuditEventStore,
      SecurityAuditLogProjection,
      AccountSecurityScoreProjection,
      ThreatDetectionMetricsProjection,
      AuditProjectionRebuildService,
      OutboxModule,
      UnitOfWorkModule,
      UserRegisteredEventHandler,
      AccountLockedEventHandler,
      PasswordChangedEventHandler,
      SessionRevokedEventHandler,
      AuthMetricsHandler,
      NOTIFICATION_ADAPTER,
      RabbitMqNotificationAdapter,
      COMMAND_BUS,
      CommandBus,
      ...AUTH_COMMAND_HANDLERS,
   ],
})
export class AuthModule implements OnModuleInit {
   constructor(
      private readonly commandBus: CommandBus,
      private readonly moduleRef: ModuleRef,
   ) {}

   onModuleInit(): void {
      for (const handlerClass of AUTH_COMMAND_HANDLERS) {
         const handler = this.moduleRef.get<ICommandHandler<never, never>>(handlerClass, { strict: false });
         if (handler) {
            this.commandBus.registerHandler(handler);
         }
      }
   }
}
