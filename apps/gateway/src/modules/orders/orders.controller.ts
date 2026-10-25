import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import {
   ApiErrorResponses,
   COMMON_ERROR_CODES,
   CORRELATION_ID_HEADER,
   CurrentUser,
   type JwtPayload,
   ResponseMessage,
} from '@common';
import { CreateOrderDto, ORDER_RESPONSE_MESSAGES, OrderResponseDto } from '@contracts/order';
import { OrdersService } from '@/modules/orders/orders.service';

@ApiTags('Orders')
@Controller('orders')
@ApiBearerAuth()
@ApiCookieAuth()
export class OrdersController {
   constructor(private readonly ordersService: OrdersService) {}

   @Post()
   @HttpCode(HttpStatus.CREATED)
   @ApiOperation({
      operationId: 'createOrder',
      summary: 'Create a new order',
      description: 'Places a new purchase order with line items, shipping details, and payment method selection.',
   })
   @ApiResponse({
      status: HttpStatus.CREATED,
      description: 'Order created successfully and awaiting payment or confirmed.',
      type: OrderResponseDto,
   })
   @ApiErrorResponses([
      {
         status: HttpStatus.BAD_REQUEST,
         description: 'Invalid input parameters or empty order items',
         errorCodes: [COMMON_ERROR_CODES.INVALID_REQUEST],
      },
      {
         status: HttpStatus.UNAUTHORIZED,
         description: 'Authentication token is missing or expired',
         errorCodes: [COMMON_ERROR_CODES.UNAUTHORIZED],
      },
   ])
   @ResponseMessage(ORDER_RESPONSE_MESSAGES.CREATE_ORDER_SUCCESS)
   async createOrder(
      @CurrentUser() user: JwtPayload,
      @Body() dto: CreateOrderDto,
      @Req() req: Request,
   ): Promise<OrderResponseDto> {
      const correlationId = req.headers[CORRELATION_ID_HEADER] as string | undefined;
      return this.ordersService.createOrder(user.sub, dto, correlationId);
   }

   @Get('my-orders')
   @HttpCode(HttpStatus.OK)
   @ApiOperation({
      operationId: 'getMyOrders',
      summary: 'Get order history for current user',
      description: 'Retrieves a paginated list of orders placed by the currently authenticated user.',
   })
   @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
   @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
   @ApiResponse({
      status: HttpStatus.OK,
      description: 'Order history list retrieved successfully.',
   })
   @ApiErrorResponses([
      {
         status: HttpStatus.UNAUTHORIZED,
         description: 'Authentication token is missing or expired',
         errorCodes: [COMMON_ERROR_CODES.UNAUTHORIZED],
      },
   ])
   @ResponseMessage(ORDER_RESPONSE_MESSAGES.GET_ORDERS_SUCCESS)
   async getMyOrders(
      @CurrentUser() user: JwtPayload,
      @Query('page') page = 1,
      @Query('limit') limit = 20,
      @Req() req: Request,
   ) {
      const correlationId = req.headers[CORRELATION_ID_HEADER] as string | undefined;
      return this.ordersService.getOrdersByUserId(user.sub, Number(page), Number(limit), correlationId);
   }

   @Get(':id')
   @HttpCode(HttpStatus.OK)
   @ApiOperation({
      operationId: 'getOrderById',
      summary: 'Get order details by ID',
      description: 'Retrieves detailed information for a specific order including line items and current status.',
   })
   @ApiParam({ name: 'id', description: 'UUID of the order', type: String })
   @ApiResponse({
      status: HttpStatus.OK,
      description: 'Order details retrieved successfully.',
      type: OrderResponseDto,
   })
   @ApiErrorResponses([
      {
         status: HttpStatus.NOT_FOUND,
         description: 'Order not found',
         errorCodes: [COMMON_ERROR_CODES.RESOURCE_NOT_FOUND],
      },
      {
         status: HttpStatus.UNAUTHORIZED,
         description: 'Authentication token is missing or expired',
         errorCodes: [COMMON_ERROR_CODES.UNAUTHORIZED],
      },
   ])
   @ResponseMessage(ORDER_RESPONSE_MESSAGES.GET_ORDER_SUCCESS)
   async getOrderById(
      @Param('id') orderId: string,
      @CurrentUser() user: JwtPayload,
      @Req() req: Request,
   ): Promise<OrderResponseDto> {
      const correlationId = req.headers[CORRELATION_ID_HEADER] as string | undefined;
      return this.ordersService.getOrderById(orderId, user.sub, correlationId);
   }

   @Post(':id/cancel')
   @HttpCode(HttpStatus.OK)
   @ApiOperation({
      operationId: 'cancelOrder',
      summary: 'Cancel an active order',
      description: 'Cancels an existing order if it has not yet progressed to shipping or delivery.',
   })
   @ApiParam({ name: 'id', description: 'UUID of the order to cancel', type: String })
   @ApiResponse({
      status: HttpStatus.OK,
      description: 'Order successfully cancelled.',
      type: OrderResponseDto,
   })
   @ApiErrorResponses([
      {
         status: HttpStatus.BAD_REQUEST,
         description: 'Order cannot be cancelled in its current state',
         errorCodes: [COMMON_ERROR_CODES.INVALID_REQUEST],
      },
      {
         status: HttpStatus.NOT_FOUND,
         description: 'Order not found',
         errorCodes: [COMMON_ERROR_CODES.RESOURCE_NOT_FOUND],
      },
   ])
   @ResponseMessage(ORDER_RESPONSE_MESSAGES.CANCEL_ORDER_SUCCESS)
   async cancelOrder(
      @Param('id') orderId: string,
      @Body('reason') reason: string,
      @CurrentUser() user: JwtPayload,
      @Req() req: Request,
   ): Promise<OrderResponseDto> {
      const correlationId = req.headers[CORRELATION_ID_HEADER] as string | undefined;
      return this.ordersService.cancelOrder(orderId, user.sub, reason, correlationId);
   }
}
