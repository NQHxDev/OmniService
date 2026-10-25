/**
 * Encodes an arbitrary payload into a URL-safe base64 string cursor.
 */
export function encodeCursor<T>(data: T): string {
   return Buffer.from(JSON.stringify(data)).toString('base64url');
}

/**
 * Decodes a URL-safe base64 string cursor back into typed data.
 * Returns null if the cursor is empty or malformed.
 */
export function decodeCursor<T>(cursor?: string | null): T | null {
   if (!cursor || !cursor.trim()) {
      return null;
   }
   try {
      const trimmed = cursor.trim();
      const decoded = Buffer.from(trimmed, 'base64url').toString('utf8');
      return JSON.parse(decoded) as T;
   } catch {
      return null;
   }
}

/**
 * Decodes a cursor specifically expected as an Elasticsearch search_after array (e.g. [timestamp, id]).
 * Returns undefined if invalid or not an array.
 */
export function decodeSearchAfterCursor(cursor?: string | null): (string | number)[] | undefined {
   const parsed = decodeCursor<unknown>(cursor);
   if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed as (string | number)[];
   }
   return undefined;
}
