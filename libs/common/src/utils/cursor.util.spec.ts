import { decodeCursor, decodeSearchAfterCursor, encodeCursor } from './cursor.util';

describe('cursor.util', () => {
   describe('encodeCursor & decodeCursor', () => {
      it('should encode and decode arbitrary objects', () => {
         const original = { createdAt: '2026-10-01T00:00:00.000Z', id: 'post-123' };
         const cursor = encodeCursor(original);

         expect(typeof cursor).toBe('string');
         expect(cursor).not.toContain('+');
         expect(cursor).not.toContain('/');

         const decoded = decodeCursor<typeof original>(cursor);
         expect(decoded).toEqual(original);
      });

      it('should return null for invalid or empty cursor', () => {
         expect(decodeCursor(null)).toBeNull();
         expect(decodeCursor(undefined)).toBeNull();
         expect(decodeCursor('')).toBeNull();
         expect(decodeCursor('   ')).toBeNull();
         expect(decodeCursor('not-valid-base64-json-!@#$')).toBeNull();
      });
   });

   describe('decodeSearchAfterCursor', () => {
      it('should decode search_after array', () => {
         const original = [1760000000000, 'post-123'];
         const cursor = encodeCursor(original);

         const decoded = decodeSearchAfterCursor(cursor);
         expect(decoded).toEqual(original);
      });

      it('should return undefined if decoded payload is not an array', () => {
         const notAnArray = encodeCursor({ id: 'abc' });
         expect(decodeSearchAfterCursor(notAnArray)).toBeUndefined();
      });

      it('should return undefined for empty cursor', () => {
         expect(decodeSearchAfterCursor(null)).toBeUndefined();
         expect(decodeSearchAfterCursor('')).toBeUndefined();
      });
   });
});
