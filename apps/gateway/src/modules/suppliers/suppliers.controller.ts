import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, Req } from '@nestjs/common';
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
   ListSuppliersQueryDto,
   ListSuppliersResponseDto,
   MySupplierResponseDto,
   RegisterSupplierDto,
   SUPPLIER_ERROR_CODES,
   SUPPLIER_RESPONSE_MESSAGES,
   SupplierItemDto,
   UpdateSupplierDto,
   UpdateSupplierStatusDto,
   VerifySupplierDto,
} from '@contracts/supplier';
import { SuppliersService } from '@/modules/suppliers/suppliers.service';

@ApiTags('Suppliers')
@Controller('suppliers')
export class SuppliersController {
   constructor(private readonly suppliersService: SuppliersService) {}

   @Post()
   @ApiCookieAuth()
   @ApiBearerAuth()
   @HttpCode(HttpStatus.CREATED)
   @ApiOperation({
      operationId: 'registerSupplier',
      summary: 'Step 2/2: Submit supplier store details and complete merchant onboarding',
      description: `### Workflow: Supplier / Merchant Onboarding (Step 2 of 2)
#### Prerequisites
- Must be authenticated with an active account (role \`SUPPLIER\` or standard merchant).

#### Process Flow
- Creates store profile with brand name, contact email/phone, tax identification code, and warehouse address.
- Automatically associates the authenticated user account as store OWNER.

#### Next Step
- Store profile created. Check onboarding verification status via \`GET /api/v1/suppliers/me\`.`,
   })
   @ApiResponse({
      status: HttpStatus.CREATED,
      description: 'Supplier registered successfully.',
      type: SupplierItemDto,
      links: {
         GetMySupplier: {
            operationId: 'getMySupplierProfile',
            description: 'Check supplier onboarding verification state and retrieve store profile',
         },
      },
   })
   @ApiErrorResponses([
      {
         status: HttpStatus.UNAUTHORIZED,
         description: 'Authentication token is missing, expired, or invalid',
         errorCodes: [COMMON_ERROR_CODES.UNAUTHORIZED],
      },
      {
         status: HttpStatus.CONFLICT,
         description: 'Supplier code/slug already exists, or user already registered a supplier',
         errorCodes: [
            SUPPLIER_ERROR_CODES.SUPPLIER_CODE_ALREADY_EXISTS,
            SUPPLIER_ERROR_CODES.SUPPLIER_SLUG_ALREADY_EXISTS,
            SUPPLIER_ERROR_CODES.SUPPLIER_ALREADY_EXISTS,
         ],
      },
   ])
   @ResponseMessage(SUPPLIER_RESPONSE_MESSAGES.REGISTER_SUPPLIER_SUCCESS)
   async registerSupplier(
      @Body() dto: RegisterSupplierDto,
      @Req() req: Request,
      @CurrentUser() user?: JwtPayload,
   ): Promise<SupplierItemDto> {
      const correlationId = (req.headers[CORRELATION_ID_HEADER] as string) || undefined;

      return this.suppliersService.registerSupplier(dto, {
         correlationId,
         accountId: user?.sub,
         roles: user?.roles,
         permissions: user?.permissions,
         email: user?.email,
      });
   }

   @Get('me')
   @ApiCookieAuth()
   @ApiBearerAuth()
   @ApiOperation({
      operationId: 'getMySupplierProfile',
      summary: 'Get supplier onboarding status and store profile for the authenticated merchant',
      description: `### Workflow: Supplier Onboarding Verification Check
#### Prerequisites
- Authenticated merchant session.

#### Process Flow
- Returns the supplier profile and member role if the authenticated account has completed store onboarding (\`hasSupplier: true\`), or \`hasSupplier: false\` if store registration is still required.

#### Next Step
- If verified, proceed to create product offers in catalog via \`POST /api/v1/commerce/products\`.`,
   })
   @ApiResponse({
      status: HttpStatus.OK,
      description: 'Supplier profile and onboarding status retrieved successfully.',
      type: MySupplierResponseDto,
      links: {
         CreateProductOffer: {
            operationId: 'createProductOffer',
            description: 'Create supplier product offers linking store inventory to standardized ingredients',
         },
      },
   })
   @ApiErrorResponses([
      {
         status: HttpStatus.UNAUTHORIZED,
         description: 'Authentication token is missing, expired, or invalid',
         errorCodes: [COMMON_ERROR_CODES.UNAUTHORIZED],
      },
   ])
   @ResponseMessage(SUPPLIER_RESPONSE_MESSAGES.GET_MY_SUPPLIER_SUCCESS)
   async getMySupplier(@Req() req: Request, @CurrentUser() user?: JwtPayload): Promise<MySupplierResponseDto> {
      const correlationId = (req.headers[CORRELATION_ID_HEADER] as string) || undefined;

      return this.suppliersService.getMySupplier({
         correlationId,
         accountId: user?.sub,
         roles: user?.roles,
         permissions: user?.permissions,
         email: user?.email,
      });
   }

   @Get()
   @Public()
   @HttpCode(HttpStatus.OK)
   @ApiOperation({
      operationId: 'listSuppliers',
      summary: 'List and filter suppliers with pagination',
      description:
         'Retrieves a paginated list of registered suppliers filtered by verification status, operational status, or city.',
   })
   @ApiResponse({
      status: HttpStatus.OK,
      description: 'List of suppliers retrieved successfully.',
      type: ListSuppliersResponseDto,
   })
   @ApiErrorResponses([
      {
         status: HttpStatus.BAD_REQUEST,
         description: 'Invalid query parameters',
         errorCodes: [COMMON_ERROR_CODES.INVALID_REQUEST],
      },
   ])
   @ResponseMessage(SUPPLIER_RESPONSE_MESSAGES.LIST_SUPPLIERS_SUCCESS)
   async listSuppliers(
      @Query() query: ListSuppliersQueryDto,
      @Req() req: Request,
      @CurrentUser() user?: JwtPayload,
   ): Promise<ListSuppliersResponseDto> {
      const correlationId = (req.headers[CORRELATION_ID_HEADER] as string) || undefined;

      return this.suppliersService.listSuppliers(query, {
         correlationId,
         accountId: user?.sub,
         roles: user?.roles,
         permissions: user?.permissions,
         email: user?.email,
      });
   }

   @Get(':supplierId')
   @Public()
   @HttpCode(HttpStatus.OK)
   @ApiOperation({
      operationId: 'getSupplierById',
      summary: 'Get supplier details by ID',
      description: 'Retrieves public store and merchant details for a specific supplier by ID.',
   })
   @ApiParam({
      name: 'supplierId',
      description: 'Supplier unique identifier UUID',
      example: '0192e21b-0001-7000-8000-000000000001',
   })
   @ApiResponse({
      status: HttpStatus.OK,
      description: 'Supplier details retrieved successfully.',
      type: SupplierItemDto,
   })
   @ApiErrorResponses([
      {
         status: HttpStatus.NOT_FOUND,
         description: 'Supplier not found',
         errorCodes: [SUPPLIER_ERROR_CODES.SUPPLIER_NOT_FOUND],
      },
   ])
   @ResponseMessage(SUPPLIER_RESPONSE_MESSAGES.GET_SUPPLIER_SUCCESS)
   async getSupplierById(
      @Param('supplierId') supplierId: string,
      @Req() req: Request,
      @CurrentUser() user?: JwtPayload,
   ): Promise<SupplierItemDto> {
      const correlationId = (req.headers[CORRELATION_ID_HEADER] as string) || undefined;

      return this.suppliersService.getSupplierById(supplierId, {
         correlationId,
         accountId: user?.sub,
         roles: user?.roles,
         permissions: user?.permissions,
         email: user?.email,
      });
   }

   @Patch(':supplierId')
   @ApiCookieAuth()
   @ApiBearerAuth()
   @HttpCode(HttpStatus.OK)
   @ApiOperation({
      operationId: 'updateSupplier',
      summary: 'Update supplier store profile',
      description:
         'Updates supplier contact details, name, address, or brand logo. Restricted to the store owner or platform admin.',
   })
   @ApiParam({
      name: 'supplierId',
      description: 'Supplier unique identifier UUID',
      example: '0192e21b-0001-7000-8000-000000000001',
   })
   @ApiResponse({
      status: HttpStatus.OK,
      description: 'Supplier profile updated successfully.',
      type: SupplierItemDto,
   })
   @ApiErrorResponses([
      {
         status: HttpStatus.UNAUTHORIZED,
         description: 'Authentication token is missing, expired, or invalid',
         errorCodes: [COMMON_ERROR_CODES.UNAUTHORIZED],
      },
      {
         status: HttpStatus.FORBIDDEN,
         description: 'Caller is not the store owner or admin',
         errorCodes: [COMMON_ERROR_CODES.NOT_OWNER_OR_ADMIN],
      },
      {
         status: HttpStatus.NOT_FOUND,
         description: 'Supplier not found',
         errorCodes: [SUPPLIER_ERROR_CODES.SUPPLIER_NOT_FOUND],
      },
   ])
   @ResponseMessage(SUPPLIER_RESPONSE_MESSAGES.UPDATE_SUPPLIER_SUCCESS)
   async updateSupplier(
      @Param('supplierId') supplierId: string,
      @Body() dto: UpdateSupplierDto,
      @Req() req: Request,
      @CurrentUser() user?: JwtPayload,
   ): Promise<SupplierItemDto> {
      const correlationId = (req.headers[CORRELATION_ID_HEADER] as string) || undefined;

      return this.suppliersService.updateSupplier(supplierId, dto, {
         correlationId,
         accountId: user?.sub,
         roles: user?.roles,
         permissions: user?.permissions,
         email: user?.email,
      });
   }

   @Patch(':supplierId/status')
   @ApiCookieAuth()
   @ApiBearerAuth()
   @RequireRoles(DEFAULT_ROLES.ADMIN)
   @HttpCode(HttpStatus.OK)
   @ApiOperation({
      operationId: 'updateSupplierStatus',
      summary: 'Update supplier operational status (Admin only)',
      description:
         'Updates the operational status of a supplier merchant store (ACTIVE, PENDING, SUSPENDED). Restricted exclusively to platform administrators.',
   })
   @ApiParam({
      name: 'supplierId',
      description: 'Supplier unique identifier UUID',
      example: '0192e21b-0001-7000-8000-000000000001',
   })
   @ApiResponse({
      status: HttpStatus.OK,
      description: 'Supplier operational status updated successfully.',
      type: SupplierItemDto,
   })
   @ApiErrorResponses([
      {
         status: HttpStatus.BAD_REQUEST,
         description: 'Invalid input or status parameter provided',
         errorCodes: [COMMON_ERROR_CODES.INVALID_REQUEST, SUPPLIER_ERROR_CODES.INVALID_STATUS],
      },
      {
         status: HttpStatus.UNAUTHORIZED,
         description: 'Authentication token is missing, expired, or invalid',
         errorCodes: [COMMON_ERROR_CODES.UNAUTHORIZED],
      },
      {
         status: HttpStatus.FORBIDDEN,
         description: 'Caller does not possess ADMIN role',
         errorCodes: [COMMON_ERROR_CODES.INSUFFICIENT_ROLES, COMMON_ERROR_CODES.FORBIDDEN],
      },
      {
         status: HttpStatus.NOT_FOUND,
         description: 'Supplier not found',
         errorCodes: [SUPPLIER_ERROR_CODES.SUPPLIER_NOT_FOUND],
      },
   ])
   @ResponseMessage(SUPPLIER_RESPONSE_MESSAGES.UPDATE_SUPPLIER_STATUS_SUCCESS)
   async updateSupplierStatus(
      @Param('supplierId') supplierId: string,
      @Body() dto: UpdateSupplierStatusDto,
      @Req() req: Request,
      @CurrentUser() user?: JwtPayload,
   ): Promise<SupplierItemDto> {
      const correlationId = (req.headers[CORRELATION_ID_HEADER] as string) || undefined;

      return this.suppliersService.updateSupplierStatus(supplierId, dto.status, {
         correlationId,
         accountId: user?.sub,
         roles: user?.roles,
         permissions: user?.permissions,
         email: user?.email,
      });
   }

   @Post(':supplierId/verify')
   @ApiCookieAuth()
   @ApiBearerAuth()
   @RequireRoles(DEFAULT_ROLES.ADMIN)
   @HttpCode(HttpStatus.OK)
   @ApiOperation({
      operationId: 'verifySupplier',
      summary: 'Verify or unverify a supplier store (Admin only)',
      description: 'Sets or revokes the verified status of a supplier merchant. Requires ADMIN role.',
   })
   @ApiParam({
      name: 'supplierId',
      description: 'Supplier unique identifier UUID',
      example: '0192e21b-0001-7000-8000-000000000001',
   })
   @ApiResponse({
      status: HttpStatus.OK,
      description: 'Supplier verification status updated successfully.',
      type: SupplierItemDto,
   })
   @ApiErrorResponses([
      {
         status: HttpStatus.UNAUTHORIZED,
         description: 'Authentication token is missing or invalid',
         errorCodes: [COMMON_ERROR_CODES.UNAUTHORIZED],
      },
      {
         status: HttpStatus.FORBIDDEN,
         description: 'Caller does not possess ADMIN role',
         errorCodes: [COMMON_ERROR_CODES.INSUFFICIENT_ROLES, COMMON_ERROR_CODES.FORBIDDEN],
      },
      {
         status: HttpStatus.NOT_FOUND,
         description: 'Supplier not found',
         errorCodes: [SUPPLIER_ERROR_CODES.SUPPLIER_NOT_FOUND],
      },
   ])
   @ResponseMessage(SUPPLIER_RESPONSE_MESSAGES.VERIFY_SUPPLIER_SUCCESS)
   async verifySupplier(
      @Param('supplierId') supplierId: string,
      @Body() dto: VerifySupplierDto,
      @Req() req: Request,
      @CurrentUser() user?: JwtPayload,
   ): Promise<SupplierItemDto> {
      const correlationId = (req.headers[CORRELATION_ID_HEADER] as string) || undefined;

      return this.suppliersService.verifySupplier(supplierId, dto.isVerified, {
         correlationId,
         accountId: user?.sub,
         roles: user?.roles,
         permissions: user?.permissions,
         email: user?.email,
      });
   }
}
