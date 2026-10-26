import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Param, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import {
   ApiErrorResponses,
   COMMON_ERROR_CODES,
   CORRELATION_ID_HEADER,
   CurrentUser,
   DEFAULT_ROLES,
   type JwtPayload,
   Public,
   RequireRoles,
   ResponseMessage,
} from '@common';
import {
   InitiatePaymentDto,
   InitiatePaymentResponseDto,
   PAYMENT_RESPONSE_MESSAGES,
   PaymentTransactionResponseDto,
   RefundPaymentDto,
   WebhookProcessingResponseDto,
} from '@contracts/payment';
import { PaymentsService } from '@/modules/payments/payments.service';

@ApiTags('Payments')
@Controller('payments')
@ApiBearerAuth()
@ApiCookieAuth()
export class PaymentsController {
   constructor(private readonly paymentsService: PaymentsService) {}

   @Post('initiate')
   @HttpCode(HttpStatus.CREATED)
   @ApiOperation({
      operationId: 'initiatePayment',
      summary: 'Initiate a payment transaction',
      description: 'Generates a payment transaction session and gateway redirect URL for VNPay, MoMo, or Card.',
   })
   @ApiResponse({
      status: HttpStatus.CREATED,
      description: 'Payment transaction initialized successfully.',
      type: InitiatePaymentResponseDto,
   })
   @ApiErrorResponses([
      {
         status: HttpStatus.BAD_REQUEST,
         description: 'Invalid payment parameters or unsupported payment method',
         errorCodes: [COMMON_ERROR_CODES.INVALID_REQUEST],
      },
      {
         status: HttpStatus.UNAUTHORIZED,
         description: 'Authentication token is missing or expired',
         errorCodes: [COMMON_ERROR_CODES.UNAUTHORIZED],
      },
   ])
   @ResponseMessage(PAYMENT_RESPONSE_MESSAGES.INITIATE_PAYMENT_SUCCESS)
   async initiatePayment(
      @CurrentUser() user: JwtPayload,
      @Body() dto: InitiatePaymentDto,
      @Req() req: Request,
   ): Promise<InitiatePaymentResponseDto> {
      const correlationId = req.headers[CORRELATION_ID_HEADER] as string | undefined;
      const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
      return this.paymentsService.initiatePayment(user.sub, dto, ipAddress, correlationId);
   }

   @Get(':id')
   @HttpCode(HttpStatus.OK)
   @ApiOperation({
      operationId: 'getPaymentById',
      summary: 'Get payment transaction by ID',
      description: 'Retrieves payment status and metadata for a specific payment transaction.',
   })
   @ApiParam({ name: 'id', description: 'UUID of the payment transaction', type: String })
   @ApiResponse({
      status: HttpStatus.OK,
      description: 'Payment transaction details retrieved.',
      type: PaymentTransactionResponseDto,
   })
   @ApiErrorResponses([
      {
         status: HttpStatus.NOT_FOUND,
         description: 'Transaction not found',
         errorCodes: [COMMON_ERROR_CODES.RESOURCE_NOT_FOUND],
      },
      {
         status: HttpStatus.UNAUTHORIZED,
         description: 'Authentication token is missing or expired',
         errorCodes: [COMMON_ERROR_CODES.UNAUTHORIZED],
      },
      {
         status: HttpStatus.FORBIDDEN,
         description: 'Access denied: user is neither transaction owner nor administrator',
         errorCodes: [COMMON_ERROR_CODES.NOT_OWNER_OR_ADMIN, COMMON_ERROR_CODES.FORBIDDEN],
      },
   ])
   @ResponseMessage(PAYMENT_RESPONSE_MESSAGES.GET_PAYMENT_SUCCESS)
   async getPaymentById(
      @Param('id') transactionId: string,
      @CurrentUser() user: JwtPayload,
      @Req() req: Request,
   ): Promise<PaymentTransactionResponseDto> {
      const correlationId = req.headers[CORRELATION_ID_HEADER] as string | undefined;
      return this.paymentsService.getPaymentById(transactionId, user, correlationId);
   }

   @Get('order/:orderId')
   @HttpCode(HttpStatus.OK)
   @ApiOperation({
      operationId: 'getPaymentByOrderId',
      summary: 'Get payment transaction by Order ID',
      description: 'Retrieves latest payment transaction details associated with an order.',
   })
   @ApiParam({ name: 'orderId', description: 'UUID of the order', type: String })
   @ApiResponse({
      status: HttpStatus.OK,
      description: 'Payment transaction details retrieved for order.',
      type: PaymentTransactionResponseDto,
   })
   @ApiErrorResponses([
      {
         status: HttpStatus.NOT_FOUND,
         description: 'Payment transaction for order not found',
         errorCodes: [COMMON_ERROR_CODES.RESOURCE_NOT_FOUND],
      },
      {
         status: HttpStatus.UNAUTHORIZED,
         description: 'Authentication token is missing or expired',
         errorCodes: [COMMON_ERROR_CODES.UNAUTHORIZED],
      },
      {
         status: HttpStatus.FORBIDDEN,
         description: 'Access denied: user is neither transaction owner nor administrator',
         errorCodes: [COMMON_ERROR_CODES.NOT_OWNER_OR_ADMIN, COMMON_ERROR_CODES.FORBIDDEN],
      },
   ])
   @ResponseMessage(PAYMENT_RESPONSE_MESSAGES.GET_PAYMENT_SUCCESS)
   async getPaymentByOrderId(
      @Param('orderId') orderId: string,
      @CurrentUser() user: JwtPayload,
      @Req() req: Request,
   ): Promise<PaymentTransactionResponseDto> {
      const correlationId = req.headers[CORRELATION_ID_HEADER] as string | undefined;
      return this.paymentsService.getPaymentByOrderId(orderId, user, correlationId);
   }

   @Post('refund')
   @RequireRoles(DEFAULT_ROLES.ADMIN)
   @HttpCode(HttpStatus.OK)
   @ApiOperation({
      operationId: 'refundPayment',
      summary: 'Refund a completed payment (Admin only)',
      description:
         'Initiates a refund request to the original payment gateway provider. Restricted to platform administrators.',
   })
   @ApiResponse({
      status: HttpStatus.OK,
      description: 'Payment refunded successfully.',
   })
   @ApiErrorResponses([
      {
         status: HttpStatus.BAD_REQUEST,
         description: 'Invalid refund amount or transaction cannot be refunded',
         errorCodes: [COMMON_ERROR_CODES.INVALID_REQUEST],
      },
      {
         status: HttpStatus.UNAUTHORIZED,
         description: 'Authentication token is missing, expired, or invalid',
         errorCodes: [COMMON_ERROR_CODES.UNAUTHORIZED],
      },
      {
         status: HttpStatus.FORBIDDEN,
         description: 'Caller does not possess administrator privileges',
         errorCodes: [COMMON_ERROR_CODES.FORBIDDEN],
      },
      {
         status: HttpStatus.NOT_FOUND,
         description: 'Transaction not found',
         errorCodes: [COMMON_ERROR_CODES.RESOURCE_NOT_FOUND],
      },
   ])
   @ResponseMessage(PAYMENT_RESPONSE_MESSAGES.REFUND_PAYMENT_SUCCESS)
   async refundPayment(@Body() dto: RefundPaymentDto, @Req() req: Request, @CurrentUser() user: JwtPayload) {
      const correlationId = req.headers[CORRELATION_ID_HEADER] as string | undefined;
      return this.paymentsService.refundPayment(dto, correlationId, user);
   }

   @Post('webhooks/:provider')
   @Public()
   @HttpCode(HttpStatus.OK)
   @ApiOperation({
      operationId: 'processWebhookPost',
      summary: 'Public webhook/IPN handler for payment gateways (POST)',
      description:
         'Receives and verifies asynchronous server-to-server IPN callbacks from VNPay, MoMo, or Card processors.',
   })
   @ApiParam({ name: 'provider', description: 'Provider identifier (vnpay, momo, credit_card, cod)', type: String })
   @ApiResponse({
      status: HttpStatus.OK,
      description: 'Webhook processed and verified successfully.',
      type: WebhookProcessingResponseDto,
   })
   @ResponseMessage(PAYMENT_RESPONSE_MESSAGES.PROCESS_WEBHOOK_SUCCESS)
   async processWebhookPost(
      @Param('provider') provider: string,
      @Body() body: Record<string, unknown>,
      @Query() query: Record<string, string>,
      @Headers('x-signature') signatureHeader: string | undefined,
      @Req() req: Request,
   ): Promise<WebhookProcessingResponseDto> {
      const correlationId = req.headers[CORRELATION_ID_HEADER] as string | undefined;
      const rawPayload = typeof body === 'string' ? body : JSON.stringify(body);
      const signature = signatureHeader || query['vnp_SecureHash'] || (body['signature'] as string);

      return this.paymentsService.processWebhook(provider, rawPayload, signature, query, correlationId);
   }

   @Get('webhooks/:provider')
   @Public()
   @HttpCode(HttpStatus.OK)
   @ApiOperation({
      operationId: 'processWebhookGet',
      summary: 'Public return URL callback handler for payment gateways (GET)',
      description: 'Handles redirect return callbacks with query parameters from gateways like VNPay.',
   })
   @ApiParam({ name: 'provider', description: 'Provider identifier (vnpay, momo)', type: String })
   @ApiResponse({
      status: HttpStatus.OK,
      description: 'Return callback processed.',
      type: WebhookProcessingResponseDto,
   })
   @ResponseMessage(PAYMENT_RESPONSE_MESSAGES.PROCESS_WEBHOOK_SUCCESS)
   async processWebhookGet(
      @Param('provider') provider: string,
      @Query() query: Record<string, string>,
      @Req() req: Request,
   ): Promise<WebhookProcessingResponseDto> {
      const correlationId = req.headers[CORRELATION_ID_HEADER] as string | undefined;
      const signature = query['vnp_SecureHash'] || query['signature'];

      return this.paymentsService.processWebhook(provider, '', signature, query, correlationId);
   }
}
