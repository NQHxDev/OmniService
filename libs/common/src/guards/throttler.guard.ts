import { Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerGuard, type ThrottlerModuleOptions, ThrottlerStorage } from '@nestjs/throttler';
import { THROTTLER_OPTIONS } from '@nestjs/throttler/dist/throttler.constants';
import { Request } from 'express';

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
   constructor(
      @Inject(THROTTLER_OPTIONS) options: ThrottlerModuleOptions,
      storageService: ThrottlerStorage,
      reflector: Reflector,
   ) {
      super(options, storageService, reflector);
   }

   protected override getTracker(req: Record<string, unknown>): Promise<string> {
      const rawReq = req as unknown as Request;
      const forwarded = rawReq.headers?.['x-forwarded-for'];
      if (typeof forwarded === 'string') {
         return Promise.resolve(forwarded.split(',')[0].trim());
      }
      const realIp = rawReq.headers?.['x-real-ip'];
      if (typeof realIp === 'string') {
         return Promise.resolve(realIp);
      }
      return Promise.resolve(rawReq.ip || rawReq.socket?.remoteAddress || 'unknown-ip');
   }
}
