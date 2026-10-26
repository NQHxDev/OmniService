export const POST_SEARCH_CONSTANTS = {
   IDEMPOTENCY: {
      PREFIX: 'idempotency:search:event',
      TTL_SECONDS: 86400, // 24 hours
      buildKey: (eventKey: string): string => `idempotency:search:event:${eventKey}`,
   },
   COUNTERS: {
      KEY_PREFIX: 'post:counters',
      buildKey: (postId: string): string => `post:counters:${postId}`,
   },
   EVENTS: {
      POST_PUBLISHED_PREFIX: 'post.published',
      POST_UPDATED_PREFIX: 'post.updated',
      POST_DELETED_PREFIX: 'post.deleted',
      USER_PROFILE_UPDATED_PREFIX: 'user.profile_updated',
      SUPPLIER_INFO_UPDATED_PREFIX: 'supplier.info_updated',
   },
   PAGINATION: {
      DEFAULT_FEED_LIMIT: 3,
      MAX_FEED_LIMIT: 50,
   },
} as const;
