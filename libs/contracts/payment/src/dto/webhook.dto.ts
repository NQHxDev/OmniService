import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class PaymentWebhookPayloadDto {
   @ApiProperty({
      description: 'Payment provider identifier (e.g. vnpay, momo, stripe)',
      example: 'vnpay',
   })
   @IsNotEmpty()
   @IsString()
   provider!: string;

   @ApiProperty({
      description: 'Raw body string or query string from payment provider',
      example: 'vnp_Amount=10000000&vnp_BankCode=NCB&vnp_ResponseCode=00',
   })
   @IsNotEmpty()
   @IsString()
   rawPayload!: string;

   @ApiPropertyOptional({
      description: 'HMAC signature provided by provider',
      example: '9f83a73c1d92e...',
   })
   @IsOptional()
   @IsString()
   signature?: string;

   @ApiPropertyOptional({
      description: 'Parsed query parameters if webhook sent as GET callback',
   })
   @IsOptional()
   queryParams?: Record<string, string>;
}
