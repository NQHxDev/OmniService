import { Result } from '@common';
import { PRODUCT_ERROR_CODES } from '@contracts/product';

export class ProductSlug {
   private readonly _value: string;
   private readonly _normalizedName: string;

   constructor(value: string, normalizedName: string) {
      this._value = value;
      this._normalizedName = normalizedName;
   }

   get value(): string {
      return this._value;
   }

   get normalizedName(): string {
      return this._normalizedName;
   }

   static create(raw: string, suffix?: string): Result<ProductSlug> {
      const trimmed = raw?.trim() ?? '';
      if (!trimmed) {
         return Result.fail(PRODUCT_ERROR_CODES.PRODUCT_NOT_FOUND);
      }

      const normalized = trimmed
         .toLowerCase()
         .normalize('NFD')
         .replace(/[\u0300-\u036f]/g, '')
         .replace(/[đĐ]/g, 'd')
         .replace(/[^a-z0-9\s-]/g, '')
         .trim()
         .replace(/\s+/g, '-')
         .replace(/-+/g, '-');

      if (!normalized) {
         return Result.fail(PRODUCT_ERROR_CODES.PRODUCT_NOT_FOUND);
      }

      const finalSlug = suffix ? `${normalized}-${suffix.slice(0, 8)}` : normalized;
      return Result.ok(new ProductSlug(finalSlug, normalized));
   }

   equals(other: ProductSlug | null | undefined): boolean {
      if (!other) {
         return false;
      }
      return this._value === other.value;
   }

   toString(): string {
      return this._value;
   }
}
