import { v4 } from 'uuid';
import { isValidUuid, isValidUuidV7, isUuid, isUuidV7, UUID_V7_REGEX, uuidv7 } from '@common/utils/uuid.util';

describe('UUID Utility', () => {
   describe('uuidv7', () => {
      it('should generate a valid RFC 9562 UUIDv7 string', () => {
         const id = uuidv7();

         expect(typeof id).toBe('string');
         expect(id).toMatch(UUID_V7_REGEX);
         expect(isValidUuidV7(id)).toBe(true);
      });

      it('should generate unique values across consecutive calls', () => {
         const id1 = uuidv7();
         const id2 = uuidv7();
         const id3 = uuidv7();

         expect(id1).not.toBe(id2);
         expect(id2).not.toBe(id3);
      });
   });

   describe('isValidUuidV7', () => {
      it('should return true for valid UUIDv7 strings', () => {
         const id = uuidv7();
         expect(isValidUuidV7(id)).toBe(true);
         expect(isUuidV7(id)).toBe(true);
      });

      it('should return false for UUIDv4 strings', () => {
         const v4Id = v4();
         expect(isValidUuidV7(v4Id)).toBe(false);
         expect(isUuidV7(v4Id)).toBe(false);
      });

      it('should return false for invalid formats or empty values', () => {
         expect(isValidUuidV7('')).toBe(false);
         expect(isValidUuidV7('invalid-uuid')).toBe(false);
         expect(isValidUuidV7('12345678-1234-1234-1234-123456789012')).toBe(false);
         expect(isValidUuidV7(null)).toBe(false);
         expect(isValidUuidV7(undefined)).toBe(false);
         expect(isValidUuidV7(123)).toBe(false);
         expect(isValidUuidV7({})).toBe(false);
      });
   });

   describe('isValidUuid', () => {
      it('should return true for valid UUIDv7 and UUIDv4 strings', () => {
         const id7 = uuidv7();
         const id4 = v4();
         expect(isValidUuid(id7)).toBe(true);
         expect(isUuid(id7)).toBe(true);
         expect(isValidUuid(id4)).toBe(true);
         expect(isUuid(id4)).toBe(true);
      });

      it('should return false for invalid formats or empty values', () => {
         expect(isValidUuid('')).toBe(false);
         expect(isValidUuid('prod_1793345065775')).toBe(false);
         expect(isValidUuid('invalid-uuid')).toBe(false);
         expect(isValidUuid(null)).toBe(false);
         expect(isValidUuid(undefined)).toBe(false);
         expect(isValidUuid(123)).toBe(false);
         expect(isValidUuid({})).toBe(false);
      });
   });
});
