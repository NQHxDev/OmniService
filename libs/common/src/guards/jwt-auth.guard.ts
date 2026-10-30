import { CanActivate, ExecutionContext, Injectable, Optional } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { VerifyOptions } from 'jsonwebtoken';
import { CommonConfigService } from '@common/config/common-config.service';
import {
   AUTH_COOKIES,
   AUTH_ERROR_REASONS,
   DEFAULT_JWT_AUDIENCE,
   DEFAULT_JWT_ISSUER,
   JWT_ALGORITHM,
   JWT_TOKEN_TYPE,
} from '@common/constants/jwt.constant';
import { AuthRevocationRedisKeys } from '@common/constants/redis.constant';
import { IS_PUBLIC_KEY } from '@common/decorators/public.decorator';
import { COMMON_ERROR_CODES } from '@common/exceptions/error-codes';
import { UnauthorizedException } from '@common/exceptions/http.exceptions';
import { RedisService } from '@common/redis/redis.service';
import type { JwtPayload } from '@common/utils/jwt.util';
import { JwtUtil } from '@common/utils/jwt.util';

export interface AuthenticatedRequest extends Request {
   user?: JwtPayload;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
   constructor(
      private readonly config: CommonConfigService,
      private readonly reflector: Reflector,
      @Optional() private readonly redisService?: RedisService,
   ) {}

   private getVerifyOptions(): VerifyOptions {
      return {
         algorithms: [JWT_ALGORITHM.ES256],
         issuer: this.config.jwtIssuer || DEFAULT_JWT_ISSUER,
         audience: this.config.jwtAudience || DEFAULT_JWT_AUDIENCE,
      };
   }

   async canActivate(context: ExecutionContext): Promise<boolean> {
      const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
         context.getHandler(),
         context.getClass(),
      ]);

      const verifyOptions = this.getVerifyOptions();

      if (isPublic) {
         const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
         const token = this.extractToken(request);
         if (token) {
            try {
               const payload = JwtUtil.verify(token, this.config.jwtPublicKey, verifyOptions);
               if (!payload.tokenType || payload.tokenType === JWT_TOKEN_TYPE.ACCESS) {
                  request.user = payload;
               }
            } catch {
               // Silently ignore invalid or expired tokens on public routes
            }
         }
         return true;
      }

      const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
      const token = this.extractToken(request);

      if (!token) {
         throw new UnauthorizedException(COMMON_ERROR_CODES.UNAUTHORIZED, {
            params: { reason: AUTH_ERROR_REASONS.TOKEN_MISSING },
         });
      }

      try {
         const payload = JwtUtil.verify(token, this.config.jwtPublicKey, verifyOptions);

         if (payload.tokenType && payload.tokenType !== JWT_TOKEN_TYPE.ACCESS) {
            throw new UnauthorizedException(COMMON_ERROR_CODES.UNAUTHORIZED, {
               params: { reason: AUTH_ERROR_REASONS.INVALID_TOKEN_TYPE },
            });
         }

         if (this.redisService) {
            if (payload.jti) {
               const revokedKey = AuthRevocationRedisKeys.revokedToken(payload.jti);
               const isBlacklisted = await this.redisService.get(revokedKey);
               if (isBlacklisted) {
                  throw new UnauthorizedException(COMMON_ERROR_CODES.UNAUTHORIZED, {
                     params: { reason: AUTH_ERROR_REASONS.TOKEN_REVOKED },
                  });
               }
            }

            if (payload.sub) {
               const userRevokedAtKey = AuthRevocationRedisKeys.accountRevokedAt(payload.sub);
               const revokedAt = await this.redisService.get(userRevokedAtKey);
               if (revokedAt && payload.iat) {
                  const revokedAtTimestamp = Number(revokedAt);
                  if (payload.iat <= revokedAtTimestamp) {
                     throw new UnauthorizedException(COMMON_ERROR_CODES.UNAUTHORIZED, {
                        params: { reason: AUTH_ERROR_REASONS.USER_TOKENS_REVOKED },
                     });
                  }
               }
            }
         }

         request.user = payload;
         return true;
      } catch (err: unknown) {
         if (err instanceof UnauthorizedException) {
            throw err;
         }
         throw new UnauthorizedException(COMMON_ERROR_CODES.UNAUTHORIZED, {
            params: { reason: AUTH_ERROR_REASONS.TOKEN_INVALID_OR_EXPIRED },
         });
      }
   }

   private extractToken(request: AuthenticatedRequest): string | null {
      const authHeader = request.headers?.authorization;
      if (authHeader) {
         const [scheme, token] = authHeader.split(' ');
         if (scheme && scheme.toLowerCase() === 'bearer' && token) {
            return token.trim();
         }
      }

      const cookies = request.cookies as Record<string, string> | undefined;

      if (cookies) {
         const customCookieName = this.config.accessTokenCookieName;
         if (customCookieName && cookies[customCookieName]) {
            return cookies[customCookieName];
         }
         if (cookies[AUTH_COOKIES.ACCESS_TOKEN]) {
            return cookies[AUTH_COOKIES.ACCESS_TOKEN];
         }
         if (cookies['access_token']) {
            return cookies['access_token'];
         }
         if (cookies['accessToken']) {
            return cookies['accessToken'];
         }
         if (cookies['jwt']) {
            return cookies['jwt'];
         }
         if (cookies['token']) {
            return cookies['token'];
         }
         if (cookies['AT']) {
            return cookies['AT'];
         }
         if (cookies['at']) {
            return cookies['at'];
         }
      }

      return null;
   }
}
