/**
 * Safely converts a Date, ISO date string, epoch timestamp, or null/undefined into an ISO 8601 string or undefined.
 *
 * @param date - Date object, ISO string, timestamp number, or null/undefined
 * @returns Formatted ISO 8601 string or undefined if input is null, undefined, or invalid
 */
export function formatIsoDate(date?: Date | string | number | null): string | undefined {
   if (!date) {
      return undefined;
   }
   if (typeof date === 'string') {
      const trimmed = date.trim();
      if (!trimmed) {
         return undefined;
      }
      const parsed = new Date(trimmed);
      return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
   }
   if (typeof date === 'number') {
      const parsed = new Date(date);
      return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
   }
   if (date instanceof Date) {
      return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
   }
   return undefined;
}
