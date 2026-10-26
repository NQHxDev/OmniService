import { BadRequestException, Result } from '@common';
import { PRODUCT_ERROR_CODES } from '@contracts/product';

export class Sku {
   private readonly _value: string;

   constructor(raw: string, isInternal = false) {
      if (isInternal) {
         this._value = raw;
         return;
      }

      const result = Sku.create(raw);
      if (result.isFailure()) {
         throw new BadRequestException(result.getError());
      }
      this._value = result.getValue().value;
   }

   get value(): string {
      return this._value;
   }

   static create(raw: string): Result<Sku> {
      const trimmed = (raw || '').trim().toUpperCase();
      if (!trimmed || trimmed.length < 3 || trimmed.length > 100) {
         return Result.fail(PRODUCT_ERROR_CODES.VARIANT_SKU_ALREADY_EXISTS);
      }

      const validPattern = /^[A-Z0-9_-]+$/;
      if (!validPattern.test(trimmed)) {
         return Result.fail(PRODUCT_ERROR_CODES.VARIANT_SKU_ALREADY_EXISTS);
      }

      return Result.ok(new Sku(trimmed, true));
   }

   equals(other: Sku | null | undefined): boolean {
      if (!other) {
         return false;
      }
      return this._value === other.value;
   }

   toString(): string {
      return this._value;
   }
}
