export const ANALYZE_ERROR_CODES = {
   USER_NOT_FOUND: 'ANALYZE.USER_NOT_FOUND',
   INVALID_SESSION_DATA: 'ANALYZE.INVALID_SESSION_DATA',
   RECORD_SESSION_FAILED: 'ANALYZE.RECORD_SESSION_FAILED',
   FETCH_INTERESTS_FAILED: 'ANALYZE.FETCH_INTERESTS_FAILED',
} as const;

export type AnalyzeErrorCode = (typeof ANALYZE_ERROR_CODES)[keyof typeof ANALYZE_ERROR_CODES];

export const ANALYZE_RESPONSE_MESSAGES = {
   RECORD_SESSION_SUCCESS: 'ANALYZE.RECORD_SESSION_SUCCESS',
   GET_INTERESTS_SUCCESS: 'ANALYZE.GET_INTERESTS_SUCCESS',
} as const;

export type AnalyzeResponseMessage = (typeof ANALYZE_RESPONSE_MESSAGES)[keyof typeof ANALYZE_RESPONSE_MESSAGES];

export const ANALYZE_PATTERNS = {
   RECORD_SESSION: 'analytics.record_session',
   GET_INTERESTS: 'analytics.get_interests',
} as const;

export type AnalyzePattern = (typeof ANALYZE_PATTERNS)[keyof typeof ANALYZE_PATTERNS];

export const ANALYZE_EVENTS = {
   VIDEO_WATCHED: 'analytics.video.watched',
   AFFINITY_UPDATED: 'analytics.affinity.updated',
} as const;

export type AnalyzeEvent = (typeof ANALYZE_EVENTS)[keyof typeof ANALYZE_EVENTS];

export const ANALYZE_CACHE_KEYS = {
   USER_AFFINITY_PREFIX: 'analytics:affinity',
   SEEN_VIDEOS_PREFIX: 'analytics:seen',
   userAffinity: (userId: string): string => `analytics:affinity:${userId}`,
   seenVideos: (userId: string): string => `analytics:seen:${userId}`,
} as const;

export const ANALYZE_CACHE_TTL = {
   AFFINITY_SECONDS: 60 * 60 * 24 * 30, // 30 days
   SEEN_VIDEOS_SECONDS: 60 * 60 * 24 * 3, // 3 days deduplication
} as const;

export const SCORING_RULES = {
   SKIP_THRESHOLD_MS: 3000,
   SKIP_COMPLETION_RATE: 0.15,
   SKIP_SCORE: -1,

   MILD_COMPLETION_RATE_MIN: 0.3,
   MILD_SCORE: 1,

   HIGH_COMPLETION_RATE: 0.8,
   COMPLETION_THRESHOLD: 0.85, // 85% unique watch is considered full completion (outro-friendly)
   HIGH_SCORE: 3,

   LOOP_BONUS_PER_LOOP: 2,
   MAX_BONUS_LOOPS: 3, // Anti-bot loop abuse limit
   MAX_DURATION_COEFFICIENT: 2.0, // Cap on logarithmic duration coefficient
} as const;
