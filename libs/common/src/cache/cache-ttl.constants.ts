/**
 * Standard TTL (Time To Live) constants in seconds for cache management across OmniServices.
 */

/** 24 hours in seconds for persistent user sessions */
export const SESSION_TTL = 86400;

/** 5 minutes in seconds for short-lived one-time passwords */
export const OTP_TTL = 300;

/** 15 minutes in seconds for user profile caching */
export const USER_PROFILE_CACHE_TTL = 900;

/** 12 hours in seconds for WHO categories and product taxonomy caching */
export const PRODUCT_CATEGORIES_CACHE_TTL = 43200;

/** Standard sliding windows for rate limit counters in seconds */
export const RATE_LIMIT_WINDOW = {
   ONE_MIN: 60,
   ONE_HOUR: 3600,
   ONE_DAY: 86400,
} as const;

/**
 * Calculates dynamic TTL in seconds for token blacklist until JWT expiration.
 *
 * @param expTimestampSeconds Expiration timestamp of the JWT in seconds (epoch)
 * @param currentTimestampSeconds Current timestamp in seconds (epoch, defaults to now)
 * @returns Non-negative remaining seconds to keep the token in the blacklist
 */
export function calculateTokenBlacklistTtl(
   expTimestampSeconds: number,
   currentTimestampSeconds: number = Math.floor(Date.now() / 1000),
): number {
   return Math.max(0, expTimestampSeconds - currentTimestampSeconds);
}

/**
 * Consolidated Cache TTL dictionary for type-safe and consistent caching policies.
 */
export const CACHE_TTL = {
   SESSION: SESSION_TTL,
   OTP: OTP_TTL,
   USER_PROFILE: USER_PROFILE_CACHE_TTL,
   PRODUCT_CATEGORIES: PRODUCT_CATEGORIES_CACHE_TTL,
   RATE_LIMIT_WINDOW,
   calculateTokenBlacklistTtl,
} as const;

export type CacheTtl = typeof CACHE_TTL;
