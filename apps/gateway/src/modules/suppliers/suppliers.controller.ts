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
   NotFoundException,
   Public,
   RequireRoles,
   ResponseMessage,
} from '@common';
import {
   ListSuppliersQueryDto,
   ListSuppliersResponseDto,
   MySupplierResponseDto,
   RegisterSupplierDto,
   RejectSupplierDto,
   SubmitKybDto,
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
      summary: 'Step 1/3: Submit supplier store details and create merchant onboarding profile',
      description: `### Workflow: Merchant Onboarding & Legal Verification (Step 1 of 3)
#### Prerequisites
- Must be authenticated with an active user account.

#### Process Flow
- Registers store profile with initial status \`PENDING\` and unverified state (\`isVerified: false\`).
- Assigns caller as the store \`SUPPLIER_ADMIN\` owner.
- Unverified stores cannot publish product offers until legal documents (KYB) are reviewed and approved.

#### Next Step
- Proceed to **Step 2/3**: Submit legal identification and business license documents via \`POST /api/v1/suppliers/me/kyb\`.`,
   })
   @ApiResponse({
      status: HttpStatus.CREATED,
      description: 'Supplier profile created successfully in PENDING verification status.',
      type: SupplierItemDto,
      links: {
         SubmitKybDocument: {
            operationId: 'submitSupplierKyb',
            description: 'Step 2/3: Submit merchant identity / KYB compliance documents',
         },
         GetMySupplier: {
            operationId: 'getMySupplierProfile',
            description: 'Check store verification and onboarding status',
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
- Returns the store profile and legal compliance state (\`PENDING\`, \`UNDER_REVIEW\`, \`ACTIVE\`, \`REJECTED\`).
- If status is \`REJECTED\`, includes \`rejectionReason\` explaining necessary document corrections.

#### Next Step
- If \`PENDING\` or \`REJECTED\`, submit/re-submit legal documents via **Step 2/3** (\`POST /api/v1/suppliers/me/kyb\`).
- If verified (\`ACTIVE\`), proceed to publish product offers via catalog (\`POST /api/v1/commerce/products\`).`,
   })
   @ApiResponse({
      status: HttpStatus.OK,
      description: 'Supplier profile and onboarding status retrieved successfully.',
      type: MySupplierResponseDto,
      links: {
         SubmitKybDocument: {
            operationId: 'submitSupplierKyb',
            description: 'Submit or update merchant legal KYB documents for review',
         },
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

   @Post('me/kyb')
   @ApiCookieAuth()
   @ApiBearerAuth()
   @HttpCode(HttpStatus.OK)
   @ApiOperation({
      operationId: 'submitSupplierKyb',
      summary: 'Step 2/3: Submit merchant legal identity and business documents for compliance verification (KYB)',
      description: `### Workflow: Merchant Legal Compliance Verification (Step 2 of 3)
#### Prerequisites
- Authenticated store owner who previously registered a supplier store.
- Store operational status must be \`PENDING\` or \`REJECTED\`.

#### Process Flow
- Individual sellers submit national citizen identity card (CCCD/Passport), issue date, and 2-sided identity card photo URLs.
- Enterprise sellers submit registered legal company name, tax identification code (Mã số thuế), and business license PDF/image URL.
- All sellers specify payout settlement bank account details.
- Transitions store status to \`UNDER_REVIEW\` and notifies platform compliance administrators.

#### Next Step
- Platform compliance administrators review submitted documents and approve store via **Step 3/3** (\`POST /api/v1/suppliers/:supplierId/verify\`).`,
   })
   @ApiResponse({
      status: HttpStatus.OK,
      description: 'Merchant legal KYB documents submitted successfully for compliance review.',
      type: SupplierItemDto,
      links: {
         VerifySupplier: {
            operationId: 'verifySupplier',
            description: 'Step 3/3 (Admin): Platform administrator verifies and activates store for selling',
            parameters: {
               supplierId: '$response.body#/data/supplierId',
            },
         },
         GetMySupplier: {
            operationId: 'getMySupplierProfile',
            description: 'Check current review status of submitted KYB documents',
         },
      },
   })
   @ApiErrorResponses([
      {
         status: HttpStatus.BAD_REQUEST,
         description: 'Invalid document payload, or KYB documents have already been submitted and are under review',
         errorCodes: [
            COMMON_ERROR_CODES.INVALID_REQUEST,
            SUPPLIER_ERROR_CODES.KYB_ALREADY_SUBMITTED,
            SUPPLIER_ERROR_CODES.CANNOT_SUBMIT_KYB,
            SUPPLIER_ERROR_CODES.INVALID_KYB_DATA,
         ],
      },
      {
         status: HttpStatus.UNAUTHORIZED,
         description: 'Authentication token is missing, expired, or invalid',
         errorCodes: [COMMON_ERROR_CODES.UNAUTHORIZED],
      },
      {
         status: HttpStatus.FORBIDDEN,
         description: 'Caller does not own this supplier store',
         errorCodes: [COMMON_ERROR_CODES.FORBIDDEN, COMMON_ERROR_CODES.NOT_OWNER_OR_ADMIN],
      },
      {
         status: HttpStatus.NOT_FOUND,
         description: 'Supplier store profile not found for authenticated user',
         errorCodes: [SUPPLIER_ERROR_CODES.SUPPLIER_NOT_FOUND],
      },
   ])
   @ResponseMessage(SUPPLIER_RESPONSE_MESSAGES.SUBMIT_KYB_SUCCESS)
   async submitSupplierKyb(
      @Body() dto: SubmitKybDto,
      @Req() req: Request,
      @CurrentUser() user?: JwtPayload,
   ): Promise<SupplierItemDto> {
      const correlationId = (req.headers[CORRELATION_ID_HEADER] as string) || undefined;
      const mySupplier = await this.suppliersService.getMySupplier({
         correlationId,
         accountId: user?.sub,
         roles: user?.roles,
         permissions: user?.permissions,
         email: user?.email,
      });

      if (!mySupplier.hasSupplier || !mySupplier.supplier) {
         throw new NotFoundException(SUPPLIER_ERROR_CODES.SUPPLIER_NOT_FOUND, {
            params: { accountId: user?.sub },
         });
      }

      return this.suppliersService.submitKyb(mySupplier.supplier.supplierId, dto, {
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
      summary: 'Step 3/3: Verify and activate supplier merchant store (Admin only)',
      description: `### Workflow: Platform Compliance Approval (Step 3 of 3)
#### Prerequisites
- Caller must possess platform \`ADMIN\` role.
- Supplier store must exist and have completed Step 2 (KYB submission under review).

#### Process Flow
- Approves merchant verification documents (\`isVerified: true\`).
- Transitions operational status to \`ACTIVE\` and records verification timestamp.
- Emits \`supplier.verified\` event and unlocks live product offer publishing on marketplace.

#### Next Step
- Store is now activated. Merchant can publish inventory offers via \`POST /api/v1/commerce/products\`.`,
   })
   @ApiParam({
      name: 'supplierId',
      description: 'Supplier unique identifier UUID',
      example: '0192e21b-0001-7000-8000-000000000001',
   })
   @ApiResponse({
      status: HttpStatus.OK,
      description: 'Supplier verified and activated successfully.',
      type: SupplierItemDto,
      links: {
         CreateProductOffer: {
            operationId: 'createProductOffer',
            description: 'Publish product offers in central catalog for this verified store',
            parameters: {
               supplierId: '$response.body#/data/supplierId',
            },
         },
      },
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

   @Patch(':supplierId/reject')
   @ApiCookieAuth()
   @ApiBearerAuth()
   @RequireRoles(DEFAULT_ROLES.ADMIN)
   @HttpCode(HttpStatus.OK)
   @ApiOperation({
      operationId: 'rejectSupplierKyb',
      summary: 'Reject supplier KYB submission with reason (Admin only)',
      description: `### Workflow: Platform Compliance Document Rejection
#### Prerequisites
- Caller must possess platform \`ADMIN\` role.

#### Process Flow
- Sets store operational status to \`REJECTED\` and records official compliance \`rejectionReason\`.
- Store remains restricted from publishing offers until merchant re-submits updated valid documents.

#### Next Step
- Merchant reviews rejection reason via \`GET /api/v1/suppliers/me\` and re-submits via **Step 2/3** (\`POST /api/v1/suppliers/me/kyb\`).`,
   })
   @ApiParam({
      name: 'supplierId',
      description: 'Supplier unique identifier UUID',
      example: '0192e21b-0001-7000-8000-000000000001',
   })
   @ApiResponse({
      status: HttpStatus.OK,
      description: 'Supplier KYB submission rejected successfully with reason recorded.',
      type: SupplierItemDto,
      links: {
         SubmitKybDocument: {
            operationId: 'submitSupplierKyb',
            description: 'Merchant re-submits corrected KYB documentation addressing rejection remarks',
         },
      },
   })
   @ApiErrorResponses([
      {
         status: HttpStatus.BAD_REQUEST,
         description: 'Rejection reason is required',
         errorCodes: [COMMON_ERROR_CODES.INVALID_REQUEST, SUPPLIER_ERROR_CODES.REJECTION_REASON_REQUIRED],
      },
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
   @ResponseMessage(SUPPLIER_RESPONSE_MESSAGES.REJECT_SUPPLIER_SUCCESS)
   async rejectSupplier(
      @Param('supplierId') supplierId: string,
      @Body() dto: RejectSupplierDto,
      @Req() req: Request,
      @CurrentUser() user?: JwtPayload,
   ): Promise<SupplierItemDto> {
      const correlationId = (req.headers[CORRELATION_ID_HEADER] as string) || undefined;

      return this.suppliersService.rejectSupplier(supplierId, dto, {
         correlationId,
         accountId: user?.sub,
         roles: user?.roles,
         permissions: user?.permissions,
         email: user?.email,
      });
   }
}
