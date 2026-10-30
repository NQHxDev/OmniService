import { USER_ERROR_CODES, USER_ERROR_REASONS } from '@contracts/user';
import { Address } from '@user/domain/value-objects/address.vo';

describe('Address Value Object', () => {
   it('should create valid Address from trimmed string', () => {
      const result = Address.create('  123 Nguyen Trai, Thanh Xuan, Hanoi  ');
      expect(result.isSuccess()).toBe(true);
      const address = result.getValue();
      expect(address.getValue()).toBe('123 Nguyen Trai, Thanh Xuan, Hanoi');
   });

   it('should fail when string is empty or whitespace only', () => {
      const result = Address.create('   ');
      expect(result.isFailure()).toBe(true);
      expect(result.getError()).toBe(USER_ERROR_CODES.INVALID_ADDRESS_FORMAT);
      expect(result.getParams()).toEqual(expect.objectContaining({ reason: USER_ERROR_REASONS.EMPTY }));
   });

   it('should fail when string is null or undefined', () => {
      const resultNull = Address.create(null);
      expect(resultNull.isFailure()).toBe(true);
      expect(resultNull.getError()).toBe(USER_ERROR_CODES.INVALID_ADDRESS_FORMAT);

      const resultUndefined = Address.create(undefined);
      expect(resultUndefined.isFailure()).toBe(true);
   });

   it('should fail when string is shorter than 3 characters', () => {
      const result = Address.create('ab');
      expect(result.isFailure()).toBe(true);
      expect(result.getError()).toBe(USER_ERROR_CODES.INVALID_ADDRESS_FORMAT);
      expect(result.getParams()).toEqual(
         expect.objectContaining({
            reason: USER_ERROR_REASONS.MIN_LENGTH,
            min: 3,
            actual: 2,
         }),
      );
   });

   it('should fail when string is longer than 255 characters', () => {
      const longAddress = 'a'.repeat(256);
      const result = Address.create(longAddress);
      expect(result.isFailure()).toBe(true);
      expect(result.getError()).toBe(USER_ERROR_CODES.INVALID_ADDRESS_FORMAT);
      expect(result.getParams()).toEqual(
         expect.objectContaining({
            reason: USER_ERROR_REASONS.MAX_LENGTH,
            max: 255,
            actual: 256,
         }),
      );
   });

   it('should compare equality correctly', () => {
      const addr1 = Address.create('123 Main St').getValue();
      const addr2 = Address.create('123 Main St').getValue();
      const addr3 = Address.create('456 Other St').getValue();

      expect(addr1.equals(addr2)).toBe(true);
      expect(addr1.equals(addr3)).toBe(false);
      expect(addr1.equals(null)).toBe(false);
   });
});
