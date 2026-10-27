import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import {
   ApiErrorResponses,
   COMMON_ERROR_CODES,
   CORRELATION_ID_HEADER,
   CurrentUser,
   ForbiddenException,
   type JwtPayload,
   ResponseMessage,
} from '@common';
import {
   ListSupplierOrdersQueryDto,
   ORDER_ERROR_CODES,
   ORDER_RESPONSE_MESSAGES,
   SupplierOrderDetailDto,
   SupplierOrderListResponseDto,
   UpdateSupplierOrderStatusDto,
   UpdateSupplierOrderStatusResponseDto,
} from '@contracts/order';
import { SUPPLIER_ERROR_CODES, SUPPLIER_ERROR_REASONS } from '@contracts/supplier';
import { OrdersService } from '@/modules/orders/orders.service';
import { VerifiedSupplierGuard } from '@/modules/suppliers/guards';
import { SuppliersService } from '@/modules/suppliers/suppliers.service';

@ApiTags('Supplier Orders')
@Controller(['supplier/orders', 'suppliers/orders'])
@ApiBearerAuth()
@ApiCookieAuth()
@UseGuards(VerifiedSupplierGuard)
export class SupplierOrdersController {
   constructor(
      private readonly ordersService: OrdersService,
      private readonly suppliersService: SuppliersService,
   ) {}

   private async resolveSupplierId(user: JwtPayload, correlationId?: string): Promise<string> {
      const mySupplier = await this.suppliersService.getMySupplier({
         correlationId,
         accountId: user.sub,
         roles: user.roles,
         permissions: user.permissions,
         email: user.email,
      });

      if (!mySupplier.hasSupplier || !mySupplier.supplier) {
         throw new ForbiddenException(SUPPLIER_ERROR_CODES.SUPPLIER_NOT_VERIFIED, {
            params: { accountId: user.sub, reason: SUPPLIER_ERROR_REASONS.NO_SUPPLIER_STORE },
         });
      }

      return mySupplier.supplier.supplierId;
   }

   @Get()
   @HttpCode(HttpStatus.OK)
   @ApiOperation({
      operationId: 'listSupplierOrders',
      summary: 'List supplier orders with filters, search, and badge count metrics',
      description:
         'Retrieves a paginated list of purchase orders assigned to the authenticated merchant store. Supports grouping (shipping/needs_action), lifecycle statuses, payment statuses, date ranges, full-text search, and summary badge metrics.',
   })
   @ApiResponse({
      status: HttpStatus.OK,
      description: 'Supplier orders retrieved successfully with pagination and summary badge metrics.',
      type: SupplierOrderListResponseDto,
   })
   @ApiErrorResponses([
      {
         status: HttpStatus.BAD_REQUEST,
         description: 'Invalid query filter parameters',
         errorCodes: [COMMON_ERROR_CODES.INVALID_REQUEST],
      },
      {
         status: HttpStatus.UNAUTHORIZED,
         description: 'Authentication token is missing, expired, or invalid',
         errorCodes: [COMMON_ERROR_CODES.UNAUTHORIZED],
      },
      {
         status: HttpStatus.FORBIDDEN,
         description: 'Authenticated merchant store profile is missing or unverified',
         errorCodes: [ORDER_ERROR_CODES.SUPPLIER_PROFILE_REQUIRED, SUPPLIER_ERROR_CODES.SUPPLIER_NOT_VERIFIED],
      },
   ])
   @ResponseMessage(ORDER_RESPONSE_MESSAGES.LIST_SUPPLIER_ORDERS_SUCCESS)
   async listSupplierOrders(
      @CurrentUser() user: JwtPayload,
      @Query() query: ListSupplierOrdersQueryDto,
      @Req() req: Request,
   ): Promise<SupplierOrderListResponseDto> {
      const correlationId = req.headers[CORRELATION_ID_HEADER] as string | undefined;
      const supplierId = await this.resolveSupplierId(user, correlationId);
      return this.ordersService.listSupplierOrders(supplierId, query, correlationId);
   }

   @Get(':orderId')
   @HttpCode(HttpStatus.OK)
   @ApiOperation({
      operationId: 'getSupplierOrderById',
      summary: 'Get supplier order details by ID',
      description:
         'Retrieves complete order information including customer contact details, purchased items, timeline milestones, and delivery information for the authenticated merchant store.',
   })
   @ApiParam({ name: 'orderId', description: 'UUID of the purchase order', type: String })
   @ApiResponse({
      status: HttpStatus.OK,
      description: 'Supplier order details retrieved successfully.',
      type: SupplierOrderDetailDto,
   })
   @ApiErrorResponses([
      {
         status: HttpStatus.UNAUTHORIZED,
         description: 'Authentication token is missing, expired, or invalid',
         errorCodes: [COMMON_ERROR_CODES.UNAUTHORIZED],
      },
      {
         status: HttpStatus.FORBIDDEN,
         description: 'Order does not belong to the merchant store or store unverified',
         errorCodes: [ORDER_ERROR_CODES.FORBIDDEN_SUPPLIER_ORDER, SUPPLIER_ERROR_CODES.SUPPLIER_NOT_VERIFIED],
      },
      {
         status: HttpStatus.NOT_FOUND,
         description: 'Order not found',
         errorCodes: [COMMON_ERROR_CODES.RESOURCE_NOT_FOUND],
      },
   ])
   @ResponseMessage(ORDER_RESPONSE_MESSAGES.GET_SUPPLIER_ORDER_SUCCESS)
   async getSupplierOrderById(
      @Param('orderId') orderId: string,
      @CurrentUser() user: JwtPayload,
      @Req() req: Request,
   ): Promise<SupplierOrderDetailDto> {
      const correlationId = req.headers[CORRELATION_ID_HEADER] as string | undefined;
      const supplierId = await this.resolveSupplierId(user, correlationId);
      return this.ordersService.getSupplierOrderById(orderId, supplierId, correlationId);
   }

   @Patch(':orderId/status')
   @HttpCode(HttpStatus.OK)
   @ApiOperation({
      operationId: 'updateSupplierOrderStatus',
      summary: 'Update order lifecycle status by supplier',
      description:
         'Transitions the order through its lifecycle state machine (CONFIRMED, PROCESSING, SHIPPING, COMPLETED, CANCELLED). Records state timeline milestones and associates shipper tracking waybill codes when handing off to logistics partners.',
   })
   @ApiParam({ name: 'orderId', description: 'UUID of the purchase order', type: String })
   @ApiResponse({
      status: HttpStatus.OK,
      description: 'Order status updated successfully.',
      type: UpdateSupplierOrderStatusResponseDto,
   })
   @ApiErrorResponses([
      {
         status: HttpStatus.BAD_REQUEST,
         description: 'Invalid status transition or order already terminal',
         errorCodes: [
            ORDER_ERROR_CODES.INVALID_STATUS_TRANSITION,
            ORDER_ERROR_CODES.ORDER_ALREADY_IN_STATUS,
            ORDER_ERROR_CODES.CANNOT_TRANSITION_TERMINAL_STATUS,
            COMMON_ERROR_CODES.INVALID_REQUEST,
         ],
      },
      {
         status: HttpStatus.UNAUTHORIZED,
         description: 'Authentication token is missing, expired, or invalid',
         errorCodes: [COMMON_ERROR_CODES.UNAUTHORIZED],
      },
      {
         status: HttpStatus.FORBIDDEN,
         description: 'Order does not belong to the merchant store or store unverified',
         errorCodes: [ORDER_ERROR_CODES.FORBIDDEN_SUPPLIER_ORDER, SUPPLIER_ERROR_CODES.SUPPLIER_NOT_VERIFIED],
      },
      {
         status: HttpStatus.NOT_FOUND,
         description: 'Order not found',
         errorCodes: [COMMON_ERROR_CODES.RESOURCE_NOT_FOUND],
      },
   ])
   @ResponseMessage(ORDER_RESPONSE_MESSAGES.UPDATE_SUPPLIER_ORDER_STATUS_SUCCESS)
   async updateSupplierOrderStatus(
      @Param('orderId') orderId: string,
      @Body() dto: UpdateSupplierOrderStatusDto,
      @CurrentUser() user: JwtPayload,
      @Req() req: Request,
   ): Promise<UpdateSupplierOrderStatusResponseDto> {
      const correlationId = req.headers[CORRELATION_ID_HEADER] as string | undefined;
      const supplierId = await this.resolveSupplierId(user, correlationId);
      return this.ordersService.updateSupplierOrderStatus(orderId, supplierId, dto, correlationId);
   }
}
