import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';
import { PAYMENT_METHODS, type PaymentMethod } from '@contracts/payment/constants/payment.constant';

export class InitiatePaymentDto {
   @ApiProperty({
      description: 'UUID of the order to pay for',
      example: 'b0000000-0000-0000-0000-000000000001',
   })
   @IsNotEmpty()
   @IsString()
   orderId!: string;

   @ApiPropertyOptional({
      description: 'Payment amount (if omitted, looked up from order details)',
      example: 250000,
   })
   @IsOptional()
   @IsNumber()
   @IsPositive()
   amount?: number;

   @ApiPropertyOptional({
      description: 'Currency code',
      example: 'VND',
      default: 'VND',
   })
   @IsOptional()
   @IsString()
   currency?: string;

   @ApiProperty({
      description: 'Payment method chosen for payment execution',
      enum: PAYMENT_METHODS,
      example: PAYMENT_METHODS.VNPAY,
   })
   @IsNotEmpty()
   @IsEnum(PAYMENT_METHODS)
   paymentMethod!: PaymentMethod;

   @ApiPropertyOptional({
      description: 'Client return URL after redirect gateway completion',
      example: 'https://omniservices.com/checkout/callback',
   })
   @IsOptional()
   @IsString()
   returnUrl?: string;

   @ApiPropertyOptional({
      description: 'Brief description of the purchase',
      example: 'Payment for Order #ORD-123456',
   })
   @IsOptional()
   @IsString()
   @MaxLength(255)
   orderDescription?: string;
}

export class RefundPaymentDto {
   @ApiProperty({
      description: 'UUID of the payment transaction to refund',
      example: 't0000000-0000-0000-0000-000000000001',
   })
   @IsNotEmpty()
   @IsString()
   transactionId!: string;

   @ApiProperty({
      description: 'Amount to refund',
      example: 50000,
   })
   @IsNumber()
   @IsPositive()
   amount!: number;

   @ApiPropertyOptional({
      description: 'Reason for refund request',
      example: 'Customer requested cancellation before shipment',
   })
   @IsOptional()
   @IsString()
   @MaxLength(255)
   reason?: string;
}
