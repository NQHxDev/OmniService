import { Result } from '@common';
import { USER_ERROR_CODES, USER_ERROR_REASONS } from '@contracts/user';

/**
 * Value Object encapsulating domain invariants for User Address.
 */
export class Address {
   private constructor(private readonly value: string) {}

   /**
    * Factory method to create and validate an Address value object.
    * Trims leading/trailing whitespace and validates length (3-255 chars).
    */
   static create(raw?: string | null): Result<Address> {
      const trimmed = raw?.trim() ?? '';

      if (!trimmed) {
         return Result.fail(USER_ERROR_CODES.INVALID_ADDRESS_FORMAT, {
            reason: USER_ERROR_REASONS.EMPTY,
         });
      }

      if (trimmed.length < 3) {
         return Result.fail(USER_ERROR_CODES.INVALID_ADDRESS_FORMAT, {
            reason: USER_ERROR_REASONS.MIN_LENGTH,
            min: 3,
            actual: trimmed.length,
         });
      }

      if (trimmed.length > 255) {
         return Result.fail(USER_ERROR_CODES.INVALID_ADDRESS_FORMAT, {
            reason: USER_ERROR_REASONS.MAX_LENGTH,
            max: 255,
            actual: trimmed.length,
         });
      }

      return Result.ok(new Address(trimmed));
   }

   /**
    * Returns the trimmed address string.
    */
   getValue(): string {
      return this.value;
   }

   /**
    * Value equality comparison.
    */
   equals(other: Address | null | undefined): boolean {
      if (!other) {
         return false;
      }
      return this.value === other.value;
   }
}
