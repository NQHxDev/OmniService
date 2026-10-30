import {
   CACHE_TTL,
   calculateTokenBlacklistTtl,
   OTP_TTL,
   PRODUCT_CATEGORIES_CACHE_TTL,
   RATE_LIMIT_WINDOW,
   SESSION_TTL,
   USER_PROFILE_CACHE_TTL,
} from '@common/cache/cache-ttl.constants';

describe('cache-ttl.constants', () => {
   it('should expose consistent TTL constants', () => {
      expect(SESSION_TTL).toBe(86400);
      expect(OTP_TTL).toBe(300);
      expect(USER_PROFILE_CACHE_TTL).toBe(900);
      expect(PRODUCT_CATEGORIES_CACHE_TTL).toBe(43200);
      expect(RATE_LIMIT_WINDOW.ONE_MIN).toBe(60);
      expect(RATE_LIMIT_WINDOW.ONE_HOUR).toBe(3600);
      expect(RATE_LIMIT_WINDOW.ONE_DAY).toBe(86400);

      expect(CACHE_TTL.SESSION).toBe(SESSION_TTL);
      expect(CACHE_TTL.OTP).toBe(OTP_TTL);
      expect(CACHE_TTL.USER_PROFILE).toBe(USER_PROFILE_CACHE_TTL);
      expect(CACHE_TTL.PRODUCT_CATEGORIES).toBe(PRODUCT_CATEGORIES_CACHE_TTL);
      expect(CACHE_TTL.RATE_LIMIT_WINDOW).toEqual(RATE_LIMIT_WINDOW);
   });

   it('should compute remaining blacklist TTL correctly', () => {
      const now = 1000;
      const futureExp = 1500;
      expect(calculateTokenBlacklistTtl(futureExp, now)).toBe(500);

      const pastExp = 900;
      expect(calculateTokenBlacklistTtl(pastExp, now)).toBe(0);
   });
});
