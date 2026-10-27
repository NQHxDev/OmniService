import { formatIsoDate } from '@common/utils/date.util';

describe('formatIsoDate Utility', () => {
   it('should format a valid Date object to ISO string', () => {
      const date = new Date('2026-10-27T10:00:00.000Z');
      expect(formatIsoDate(date)).toBe('2026-10-27T10:00:00.000Z');
   });

   it('should normalize a valid ISO or date string to standard ISO string', () => {
      expect(formatIsoDate('2026-10-27T10:00:00.000Z')).toBe('2026-10-27T10:00:00.000Z');
      expect(formatIsoDate('2026-10-27')).toBe(new Date('2026-10-27').toISOString());
   });

   it('should format numeric epoch timestamps', () => {
      const timestamp = 1793095200000;
      expect(formatIsoDate(timestamp)).toBe(new Date(timestamp).toISOString());
   });

   it('should return undefined for null, undefined, or empty strings', () => {
      expect(formatIsoDate(null)).toBeUndefined();
      expect(formatIsoDate(undefined)).toBeUndefined();
      expect(formatIsoDate('')).toBeUndefined();
      expect(formatIsoDate('   ')).toBeUndefined();
   });

   it('should return undefined for invalid dates', () => {
      expect(formatIsoDate('invalid-date-string')).toBeUndefined();
      expect(formatIsoDate(new Date('invalid'))).toBeUndefined();
      expect(formatIsoDate(NaN)).toBeUndefined();
   });
});
