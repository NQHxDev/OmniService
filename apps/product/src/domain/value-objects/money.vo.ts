import { BadRequestException } from '@common';
import { CURRENCY, CurrencyType, PRODUCT_ERROR_CODES } from '@contracts/product';

export class Money {
   private readonly _amount: number;
   private readonly _currency: CurrencyType;

   constructor(amount: number, currency: CurrencyType = CURRENCY.VND) {
      if (amount < 0 || isNaN(amount)) {
         throw new BadRequestException(PRODUCT_ERROR_CODES.VARIANT_INVALID_QUANTITY);
      }
      this._amount = Math.round(amount * 100) / 100;
      this._currency = currency;
   }

   get amount(): number {
      return this._amount;
   }

   get currency(): CurrencyType {
      return this._currency;
   }

   equals(other: Money): boolean {
      return this._amount === other.amount && this._currency === other.currency;
   }
}
