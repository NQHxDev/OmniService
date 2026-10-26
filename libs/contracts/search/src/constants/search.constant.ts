export const SEARCH_PATTERNS = {
   SEARCH_USERS: 'search_users',
   SEARCH_POSTS: 'search_posts',
   SEARCH_INGREDIENTS: 'search_ingredients',
   GLOBAL_SEARCH: 'global_search',
} as const;

export type SearchPattern = (typeof SEARCH_PATTERNS)[keyof typeof SEARCH_PATTERNS];

export const SEARCH_ERROR_CODES = {
   SEARCH_FAILED: 'SEARCH.SEARCH_FAILED',
   INDEXING_FAILED: 'SEARCH.INDEXING_FAILED',
   INVALID_SEARCH_QUERY: 'SEARCH.INVALID_SEARCH_QUERY',
} as const;

export type SearchErrorCode = (typeof SEARCH_ERROR_CODES)[keyof typeof SEARCH_ERROR_CODES];

export const SEARCH_RESPONSE_MESSAGES = {
   SEARCH_SUCCESS: 'SEARCH.SEARCH_SUCCESS',
} as const;

export type SearchResponseMessage = (typeof SEARCH_RESPONSE_MESSAGES)[keyof typeof SEARCH_RESPONSE_MESSAGES];

export const SEARCH_INDICES = {
   USERS: 'users',
   POSTS: 'posts',
   FEED_POSTS: 'feed_posts_read_model',
   RECIPES: 'recipes',
   INGREDIENTS: 'ingredients',
   PRODUCTS: 'products',
} as const;

export type SearchIndex = (typeof SEARCH_INDICES)[keyof typeof SEARCH_INDICES];

export const BULK_OPERATIONS = {
   INDEX: 'index',
   UPDATE: 'update',
   DELETE: 'delete',
} as const;

export type BulkOperationType = (typeof BULK_OPERATIONS)[keyof typeof BULK_OPERATIONS];
