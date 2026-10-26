import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions } from 'express';
import { CommonConfigService, ENV_KEYS } from '@common';
import { GatewayEnvConfig } from '@/config/gateway-env.schema';

@Injectable()
export class GatewayConfigService extends CommonConfigService {
   constructor(protected override readonly configService: ConfigService<GatewayEnvConfig, true>) {
      super(configService);
   }

   get port(): number {
      return this.configService.get(ENV_KEYS.PORT, { infer: true });
   }

   get globalPrefix(): string {
      return this.configService.get(ENV_KEYS.GLOBAL_PREFIX, { infer: true });
   }

   override get jwtPublicKeyPath(): string {
      return this.configService.get(ENV_KEYS.JWT_PUBLIC_KEY_PATH, { infer: true }) || 'apps/gateway/keys/public.key';
   }

   get corsOrigins(): string[] {
      const raw: unknown = this.configService.get(ENV_KEYS.CORS_ORIGINS);
      if (!raw || typeof raw !== 'string') {
         return [];
      }
      return raw
         .split(',')
         .map((origin: string) => origin.trim())
         .filter((origin: string) => Boolean(origin));
   }

   get cookieMaxAge(): number {
      return this.accessTokenCookieMaxAge;
   }

   get accessTokenCookieOptions(): CookieOptions {
      return {
         httpOnly: true,
         secure: this.isProduction,
         sameSite: this.isProduction ? 'strict' : 'lax',
         path: '/',
         maxAge: this.accessTokenCookieMaxAge,
      };
   }

   get refreshTokenCookieOptions(): CookieOptions {
      return {
         httpOnly: true,
         secure: this.isProduction,
         sameSite: this.isProduction ? 'strict' : 'lax',
         path: '/',
         maxAge: this.refreshTokenCookieMaxAge,
      };
   }

   get cookieOptions(): CookieOptions {
      return this.accessTokenCookieOptions;
   }

   get clearCookieOptions(): CookieOptions {
      return {
         httpOnly: true,
         secure: this.isProduction,
         sameSite: this.isProduction ? 'strict' : 'lax',
         path: '/',
      };
   }

   get throttle() {
      return {
         shortTtl: this.configService.get(ENV_KEYS.THROTTLE_SHORT_TTL, { infer: true }),
         shortLimit: this.configService.get(ENV_KEYS.THROTTLE_SHORT_LIMIT, { infer: true }),
         mediumTtl: this.configService.get(ENV_KEYS.THROTTLE_MEDIUM_TTL, { infer: true }),
         mediumLimit: this.configService.get(ENV_KEYS.THROTTLE_MEDIUM_LIMIT, { infer: true }),
         longTtl: this.configService.get(ENV_KEYS.THROTTLE_LONG_TTL, { infer: true }),
         longLimit: this.configService.get(ENV_KEYS.THROTTLE_LONG_LIMIT, { infer: true }),
      };
   }

   get authGrpcUrl(): string {
      return this.configService.get(ENV_KEYS.AUTH_GRPC_URL, { infer: true }) || 'localhost:50051';
   }

   get userGrpcUrl(): string {
      return this.configService.get(ENV_KEYS.USER_GRPC_URL, { infer: true }) || 'localhost:50052';
   }

   get commerceGrpcUrl(): string {
      return this.configService.get(ENV_KEYS.COMMERCE_GRPC_URL, { infer: true }) || 'localhost:50053';
   }

   get supplierGrpcUrl(): string {
      return this.configService.get(ENV_KEYS.SUPPLIER_GRPC_URL, { infer: true }) || 'localhost:50054';
   }

   get mediaGrpcUrl(): string {
      return this.configService.get(ENV_KEYS.MEDIA_GRPC_URL, { infer: true }) || 'localhost:50055';
   }

   get searchGrpcUrl(): string {
      return this.configService.get(ENV_KEYS.SEARCH_GRPC_URL, { infer: true }) || 'localhost:50056';
   }

   get orderGrpcUrl(): string {
      return this.configService.get('ORDER_GRPC_URL' as keyof GatewayEnvConfig, { infer: true }) || 'localhost:50057';
   }

   get paymentGrpcUrl(): string {
      return this.configService.get('PAYMENT_GRPC_URL' as keyof GatewayEnvConfig, { infer: true }) || 'localhost:50058';
   }

   get postGrpcUrl(): string {
      return this.configService.get(ENV_KEYS.POST_GRPC_URL, { infer: true }) || 'localhost:50059';
   }

   get productGrpcUrl(): string {
      return this.configService.get('PRODUCT_GRPC_URL' as keyof GatewayEnvConfig, { infer: true }) || 'localhost:50060';
   }
}
