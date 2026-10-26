import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
   PAYMENT_METHODS,
   type PaymentMethod,
   PAYMENT_STATUS,
   type PaymentStatus,
} from '@contracts/payment/constants/payment.constant';

export class PaymentTransactionResponseDto {
   @ApiProperty({ description: 'UUID of the payment transaction' })
   transactionId!: string;

   @ApiProperty({ description: 'UUID of the related order' })
   orderId!: string;

   @ApiProperty({ description: 'UUID of the user who initiated payment' })
   userId!: string;

   @ApiProperty({ description: 'Amount charged' })
   amount!: number;

   @ApiProperty({ description: 'Currency standard code', example: 'VND' })
   currency!: string;

   @ApiProperty({ enum: PAYMENT_METHODS, description: 'Selected payment method' })
   paymentMethod!: PaymentMethod;

   @ApiProperty({ enum: PAYMENT_STATUS, description: 'Status of the transaction' })
   paymentStatus!: PaymentStatus;

   @ApiPropertyOptional({ description: 'Third-party provider transaction ID' })
   providerTransactionId?: string;

   @ApiPropertyOptional({ description: 'URL to redirect customer to complete payment' })
   paymentUrl?: string;

   @ApiPropertyOptional({ description: 'Failure reason description if transaction failed' })
   failureReason?: string;

   @ApiProperty({ description: 'Timestamp of transaction creation' })
   createdAt!: string;

   @ApiProperty({ description: 'Timestamp of transaction update' })
   updatedAt!: string;
}

export class InitiatePaymentResponseDto {
   @ApiProperty({ type: PaymentTransactionResponseDto, description: 'Created payment transaction' })
   transaction!: PaymentTransactionResponseDto;

   @ApiPropertyOptional({ description: 'Redirect URL for external payment gateways' })
   paymentUrl?: string;

   @ApiProperty({ description: 'True if client must redirect user to paymentUrl' })
   requiresRedirect!: boolean;
}

export class WebhookProcessingResponseDto {
   @ApiProperty({ description: 'Whether webhook processed successfully' })
   success!: boolean;

   @ApiProperty({ description: 'Response message for third-party callback provider' })
   message!: string;

   @ApiPropertyOptional({ description: 'Transaction ID involved' })
   transactionId?: string;

   @ApiPropertyOptional({ enum: PAYMENT_STATUS, description: 'Resulting payment status' })
   paymentStatus?: PaymentStatus;
}
