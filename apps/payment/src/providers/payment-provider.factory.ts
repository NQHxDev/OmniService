import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import type { IPaymentProvider } from '@payment/providers/payment-provider.interface';
import { CodPaymentProvider } from '@payment/providers/cod.provider';
import { VnPayPaymentProvider } from '@payment/providers/vnpay.provider';
import { MoMoPaymentProvider } from '@payment/providers/momo.provider';
import { CreditCardPaymentProvider } from '@payment/providers/credit-card.provider';

@Injectable()
export class PaymentProviderFactory {
   private readonly providers: Map<string, IPaymentProvider>;

   constructor(
      codProvider: CodPaymentProvider,
      vnPayProvider: VnPayPaymentProvider,
      moMoProvider: MoMoPaymentProvider,
      creditCardProvider: CreditCardPaymentProvider,
   ) {
      this.providers = new Map<string, IPaymentProvider>([
         ['COD', codProvider],
         ['VNPAY', vnPayProvider],
         ['MOMO', moMoProvider],
         ['CREDIT_CARD', creditCardProvider],
      ]);
   }

   getProvider(method: string): IPaymentProvider {
      const normalized = method?.toUpperCase();
      const provider = this.providers.get(normalized);
      if (!provider) {
         throw new RpcException({
            code: 3, // INVALID_ARGUMENT
            message: 'PAYMENT.UNSUPPORTED_METHOD',
         });
      }
      return provider;
   }
}
