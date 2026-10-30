import {
   Body,
   Controller,
   Get,
   HttpCode,
   HttpStatus,
   Param,
   ParseUUIDPipe,
   Patch,
   Post,
   Query,
   Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import {
   ApiErrorResponses,
   BadRequestException,
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
   AdjustStockDto,
   CheckAndReserveStockDto,
   CheckAndReserveStockResponseDto,
   CreateProductDto,
   ListProductsQueryDto,
   ListProductsResponseDto,
   ModerateProductDto,
   PRODUCT_ERROR_CODES,
   PRODUCT_RESPONSE_MESSAGES,
   ProductItemDto,
   ProductModerationHistoryDto,
   ReleaseStockDto,
   SearchProductsQueryDto,
   SearchProductsResponseDto,
   SuggestProductsQueryDto,
   SuggestProductsResponseDto,
   UpdateProductDto,
   UpdateProductStatusDto,
   WhoCategoryDto,
} from '@contracts/product';
import { ProductsService } from './products.service';

const UUID_PARAM_PIPE = new ParseUUIDPipe({
   exceptionFactory: () =>
      new BadRequestException(COMMON_ERROR_CODES.INVALID_REQUEST, {
         params: { expected: 'uuid' },
      }),
});

@ApiTags('Products')
@Controller('products')
export class ProductsController {
   constructor(private readonly productsService: ProductsService) {}

   @Get('categories')
   @Public()
   @HttpCode(HttpStatus.OK)
   @ApiOperation({
      operationId: 'listCategories',
      summary: 'Get WHO standardized 8 culinary food nutrition groups',
      description:
         'Returns standard food categories required when creating ingredient products (WHO 8 nutrition groups).',
   })
   @ApiResponse({
      status: HttpStatus.OK,
      description: 'WHO food categories retrieved successfully.',
      type: [WhoCategoryDto],
   })
   @ResponseMessage(PRODUCT_RESPONSE_MESSAGES.LIST_CATEGORIES_SUCCESS)
   async listCategories(@Req() req: Request, @CurrentUser() user?: JwtPayload): Promise<WhoCategoryDto[]> {
      const correlationId = (req.headers[CORRELATION_ID_HEADER] as string) || undefined;
      return this.productsService.listWhoCategories({
         correlationId,
         accountId: user?.sub,
         roles: user?.roles,
         permissions: user?.permissions,
         email: user?.email,
      });
   }

   @Post()
   @ApiCookieAuth()
   @ApiBearerAuth()
   @HttpCode(HttpStatus.CREATED)
   @ApiOperation({
      operationId: 'createProduct',
      summary: 'Supplier registers a new raw ingredient / food supply product',
      description: `### Workflow: Supplier Product Registration
#### Business Rules
- Must classify product under 1 of 8 WHO food categories.
- Initial product status is \`DRAFT\` and moderationStatus is \`PENDING_APPROVAL\`.
- Product will be indexed immediately in Search Service for discovery pipeline.
- Requires admin moderation before supplier can activate it for sales.`,
   })
   @ApiResponse({
      status: HttpStatus.CREATED,
      description: 'Product registered successfully and submitted for admin review.',
      type: ProductItemDto,
   })
   @ApiErrorResponses([
      {
         status: HttpStatus.UNAUTHORIZED,
         description: 'Authentication token is missing, expired, or invalid',
         errorCodes: [COMMON_ERROR_CODES.UNAUTHORIZED],
      },
      {
         status: HttpStatus.BAD_REQUEST,
         description: 'Validation failed or invalid WHO category',
         errorCodes: [COMMON_ERROR_CODES.INVALID_REQUEST, PRODUCT_ERROR_CODES.WHO_CATEGORY_INVALID],
      },
   ])
   @ResponseMessage(PRODUCT_RESPONSE_MESSAGES.CREATE_PRODUCT_SUCCESS)
   async createProduct(
      @Body() dto: CreateProductDto,
      @Req() req: Request,
      @CurrentUser() user?: JwtPayload,
   ): Promise<ProductItemDto> {
      const correlationId = (req.headers[CORRELATION_ID_HEADER] as string) || undefined;
      return this.productsService.createProduct(dto, {
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
      operationId: 'listProducts',
      summary: 'List products with multi-attribute filtering and pagination',
      description:
         'Search and filter products with required operational status and moderation review status, category, or keyword.',
   })
   @ApiResponse({
      status: HttpStatus.OK,
      description: 'List of matching products.',
      type: ListProductsResponseDto,
   })
   @ApiErrorResponses([
      {
         status: HttpStatus.BAD_REQUEST,
         description: 'Missing or invalid status or query parameters',
         errorCodes: [COMMON_ERROR_CODES.INVALID_REQUEST],
      },
   ])
   @ResponseMessage(PRODUCT_RESPONSE_MESSAGES.LIST_PRODUCTS_SUCCESS)
   async listProducts(
      @Query() query: ListProductsQueryDto,
      @Req() req: Request,
      @CurrentUser() user?: JwtPayload,
   ): Promise<ListProductsResponseDto> {
      const correlationId = (req.headers[CORRELATION_ID_HEADER] as string) || undefined;
      return this.productsService.listProducts(query, {
         correlationId,
         accountId: user?.sub,
         roles: user?.roles,
         permissions: user?.permissions,
         email: user?.email,
      });
   }

   @Get('search')
   @Public()
   @HttpCode(HttpStatus.OK)
   @ApiOperation({
      operationId: 'searchProducts',
      summary: 'Search products by name and attributes using Elasticsearch',
      description: `### Workflow: Culinary Recipe Ingredient Search
#### Process Flow
- Executes full-text fuzzy and phrase-prefix search on the Elasticsearch \`products\` index.
- Allows content creators and customers to search raw ingredients and food products to attach to dish recipe posts.`,
   })
   @ApiResponse({
      status: HttpStatus.OK,
      description: 'Products matching search criteria retrieved successfully from Elasticsearch.',
      type: SearchProductsResponseDto,
   })
   @ApiErrorResponses([
      {
         status: HttpStatus.BAD_REQUEST,
         description: 'Invalid search parameters or pagination limits',
         errorCodes: [COMMON_ERROR_CODES.INVALID_REQUEST],
      },
   ])
   @ResponseMessage(PRODUCT_RESPONSE_MESSAGES.SEARCH_PRODUCTS_SUCCESS)
   async searchProducts(
      @Query() query: SearchProductsQueryDto,
      @Req() req: Request,
      @CurrentUser() user?: JwtPayload,
   ): Promise<SearchProductsResponseDto> {
      const correlationId = (req.headers[CORRELATION_ID_HEADER] as string) || undefined;
      return this.productsService.searchProducts(query, {
         correlationId,
         accountId: user?.sub,
         roles: user?.roles,
         permissions: user?.permissions,
         email: user?.email,
      });
   }

   @Get('suggest')
   @Public()
   @HttpCode(HttpStatus.OK)
   @ApiOperation({
      operationId: 'suggestProducts',
      summary: 'Autocomplete / suggest products by name prefix using Elasticsearch',
      description:
         'Provides high-performance typeahead autocomplete suggestions for product names while users type in recipe ingredient inputs.',
   })
   @ApiResponse({
      status: HttpStatus.OK,
      description: 'Product suggestions retrieved successfully.',
      type: SuggestProductsResponseDto,
   })
   @ApiErrorResponses([
      {
         status: HttpStatus.BAD_REQUEST,
         description: 'Invalid autocomplete query parameters',
         errorCodes: [COMMON_ERROR_CODES.INVALID_REQUEST],
      },
   ])
   @ResponseMessage(PRODUCT_RESPONSE_MESSAGES.SUGGEST_PRODUCTS_SUCCESS)
   async suggestProducts(
      @Query() query: SuggestProductsQueryDto,
      @Req() req: Request,
      @CurrentUser() user?: JwtPayload,
   ): Promise<SuggestProductsResponseDto> {
      const correlationId = (req.headers[CORRELATION_ID_HEADER] as string) || undefined;
      return this.productsService.suggestProducts(query, {
         correlationId,
         accountId: user?.sub,
         roles: user?.roles,
         permissions: user?.permissions,
         email: user?.email,
      });
   }

   @Get(':productId')
   @Public()
   @HttpCode(HttpStatus.OK)
   @ApiOperation({
      operationId: 'getProductById',
      summary: 'Retrieve detailed product by ID including packaging variants, store info and order statistics',
      description:
         'Fetches product details, packaging variants, real-time inventory levels, a public summary of the selling store (`supplier`), and order statistics (`orderCount` = distinct delivered/completed orders, `soldCount` = total quantity sold). Store and statistics data are best-effort: if a downstream service is unavailable, `supplier` is omitted and the counters default to 0.',
   })
   @ApiParam({
      name: 'productId',
      description: 'Unique product identifier UUID',
      example: '0192e21b-0001-7000-8000-000000000001',
   })
   @ApiResponse({
      status: HttpStatus.OK,
      description: 'Product retrieved successfully.',
      type: ProductItemDto,
   })
   @ApiErrorResponses([
      {
         status: HttpStatus.NOT_FOUND,
         description: 'Product not found',
         errorCodes: [PRODUCT_ERROR_CODES.PRODUCT_NOT_FOUND],
      },
   ])
   @ResponseMessage(PRODUCT_RESPONSE_MESSAGES.GET_PRODUCT_SUCCESS)
   async getProductById(
      @Param('productId', UUID_PARAM_PIPE) productId: string,
      @Req() req: Request,
      @CurrentUser() user?: JwtPayload,
   ): Promise<ProductItemDto> {
      const correlationId = (req.headers[CORRELATION_ID_HEADER] as string) || undefined;
      return this.productsService.getProductById(productId, {
         correlationId,
         accountId: user?.sub,
         roles: user?.roles,
         permissions: user?.permissions,
         email: user?.email,
      });
   }

   @Patch(':productId')
   @ApiCookieAuth()
   @ApiBearerAuth()
   @HttpCode(HttpStatus.OK)
   @ApiOperation({
      operationId: 'updateProduct',
      summary: 'Update product information (Supplier owner only)',
      description: 'Allows merchant owner to update product attributes such as description, origin, and photos.',
   })
   @ApiParam({
      name: 'productId',
      description: 'Unique product identifier UUID',
   })
   @ApiResponse({
      status: HttpStatus.OK,
      description: 'Product updated successfully.',
      type: ProductItemDto,
   })
   @ApiErrorResponses([
      {
         status: HttpStatus.UNAUTHORIZED,
         description: 'Unauthorized access',
         errorCodes: [COMMON_ERROR_CODES.UNAUTHORIZED],
      },
      {
         status: HttpStatus.BAD_REQUEST,
         description: 'Product not owned by requester or invalid parameters',
         errorCodes: [PRODUCT_ERROR_CODES.PRODUCT_NOT_OWNED],
      },
      {
         status: HttpStatus.NOT_FOUND,
         description: 'Product not found',
         errorCodes: [PRODUCT_ERROR_CODES.PRODUCT_NOT_FOUND],
      },
   ])
   @ResponseMessage(PRODUCT_RESPONSE_MESSAGES.UPDATE_PRODUCT_SUCCESS)
   async updateProduct(
      @Param('productId', UUID_PARAM_PIPE) productId: string,
      @Body() dto: UpdateProductDto,
      @Req() req: Request,
      @CurrentUser() user?: JwtPayload,
   ): Promise<ProductItemDto> {
      const correlationId = (req.headers[CORRELATION_ID_HEADER] as string) || undefined;
      return this.productsService.updateProduct(productId, dto, {
         correlationId,
         accountId: user?.sub,
         roles: user?.roles,
         permissions: user?.permissions,
         email: user?.email,
      });
   }

   @Patch(':productId/moderate')
   @ApiCookieAuth()
   @ApiBearerAuth()
   @RequireRoles(DEFAULT_ROLES.ADMIN)
   @HttpCode(HttpStatus.OK)
   @ApiOperation({
      operationId: 'moderateProduct',
      summary: 'Approve, reject, or suspend a product with audit trail (Admin only)',
      description:
         'Platform administrators review submitted product quality, compliance, and perform moderation decisions.',
   })
   @ApiParam({
      name: 'productId',
      description: 'Unique product identifier UUID',
   })
   @ApiResponse({
      status: HttpStatus.OK,
      description: 'Product moderated successfully.',
      type: ProductItemDto,
   })
   @ApiErrorResponses([
      {
         status: HttpStatus.FORBIDDEN,
         description: 'Caller does not possess ADMIN role',
         errorCodes: [COMMON_ERROR_CODES.INSUFFICIENT_ROLES, COMMON_ERROR_CODES.FORBIDDEN],
      },
      {
         status: HttpStatus.BAD_REQUEST,
         description: 'Invalid moderation action, missing rejection reason, or invalid state',
         errorCodes: [
            PRODUCT_ERROR_CODES.MODERATION_REJECTION_REASON_REQUIRED,
            PRODUCT_ERROR_CODES.PRODUCT_NOT_IN_REVIEWABLE_STATE,
            PRODUCT_ERROR_CODES.MODERATION_ACTION_NOT_APPLICABLE,
         ],
      },
      {
         status: HttpStatus.NOT_FOUND,
         description: 'Product not found',
         errorCodes: [PRODUCT_ERROR_CODES.PRODUCT_NOT_FOUND],
      },
   ])
   @ResponseMessage(PRODUCT_RESPONSE_MESSAGES.MODERATE_PRODUCT_SUCCESS)
   async moderateProduct(
      @Param('productId', UUID_PARAM_PIPE) productId: string,
      @Body() dto: ModerateProductDto,
      @Req() req: Request,
      @CurrentUser() user?: JwtPayload,
   ): Promise<ProductItemDto> {
      const correlationId = (req.headers[CORRELATION_ID_HEADER] as string) || undefined;
      return this.productsService.moderateProduct(productId, dto, {
         correlationId,
         accountId: user?.sub,
         roles: user?.roles,
         permissions: user?.permissions,
         email: user?.email,
      });
   }

   @Post(':productId/submit-review')
   @ApiCookieAuth()
   @ApiBearerAuth()
   @HttpCode(HttpStatus.OK)
   @ApiOperation({
      operationId: 'submitProductForReview',
      summary: 'Submit product for moderation review',
      description:
         'Allows merchant supplier or platform admin to submit draft or rejected product for moderation review.',
   })
   @ApiParam({
      name: 'productId',
      description: 'Unique product identifier UUID',
   })
   @ApiResponse({
      status: HttpStatus.OK,
      description: 'Product submitted for review successfully.',
      type: ProductItemDto,
   })
   @ApiErrorResponses([
      {
         status: HttpStatus.UNAUTHORIZED,
         description: 'Unauthorized access',
         errorCodes: [COMMON_ERROR_CODES.UNAUTHORIZED],
      },
      {
         status: HttpStatus.BAD_REQUEST,
         description: 'Product not owned or not in valid reviewable state',
         errorCodes: [PRODUCT_ERROR_CODES.PRODUCT_NOT_OWNED, PRODUCT_ERROR_CODES.PRODUCT_NOT_IN_REVIEWABLE_STATE],
      },
      {
         status: HttpStatus.NOT_FOUND,
         description: 'Product not found',
         errorCodes: [PRODUCT_ERROR_CODES.PRODUCT_NOT_FOUND],
      },
   ])
   @ResponseMessage(PRODUCT_RESPONSE_MESSAGES.SUBMIT_FOR_REVIEW_SUCCESS)
   async submitProductForReview(
      @Param('productId', UUID_PARAM_PIPE) productId: string,
      @Req() req: Request,
      @CurrentUser() user?: JwtPayload,
   ): Promise<ProductItemDto> {
      const correlationId = (req.headers[CORRELATION_ID_HEADER] as string) || undefined;
      return this.productsService.submitProductForReview(productId, {
         correlationId,
         accountId: user?.sub,
         roles: user?.roles,
         permissions: user?.permissions,
         email: user?.email,
      });
   }

   @Get(':productId/moderation-history')
   @ApiCookieAuth()
   @ApiBearerAuth()
   @RequireRoles(DEFAULT_ROLES.ADMIN)
   @HttpCode(HttpStatus.OK)
   @ApiOperation({
      operationId: 'getProductModerationHistory',
      summary: 'Retrieve moderation audit trail history (Admin only)',
      description:
         'Allows platform administrators to view historical moderation decisions, actions, notes, and snapshots.',
   })
   @ApiParam({
      name: 'productId',
      description: 'Unique product identifier UUID',
   })
   @ApiResponse({
      status: HttpStatus.OK,
      description: 'Moderation history retrieved successfully.',
      type: [ProductModerationHistoryDto],
   })
   @ApiErrorResponses([
      {
         status: HttpStatus.FORBIDDEN,
         description: 'Caller does not possess ADMIN role',
         errorCodes: [COMMON_ERROR_CODES.INSUFFICIENT_ROLES, COMMON_ERROR_CODES.FORBIDDEN],
      },
      {
         status: HttpStatus.NOT_FOUND,
         description: 'Product not found',
         errorCodes: [PRODUCT_ERROR_CODES.PRODUCT_NOT_FOUND],
      },
   ])
   @ResponseMessage(PRODUCT_RESPONSE_MESSAGES.GET_MODERATION_HISTORY_SUCCESS)
   async getProductModerationHistory(
      @Param('productId', UUID_PARAM_PIPE) productId: string,
      @Req() req: Request,
      @CurrentUser() user?: JwtPayload,
   ): Promise<ProductModerationHistoryDto[]> {
      const correlationId = (req.headers[CORRELATION_ID_HEADER] as string) || undefined;
      return this.productsService.getProductModerationHistory(productId, {
         correlationId,
         accountId: user?.sub,
         roles: user?.roles,
         permissions: user?.permissions,
         email: user?.email,
      });
   }

   @Patch(':productId/status')
   @ApiCookieAuth()
   @ApiBearerAuth()
   @HttpCode(HttpStatus.OK)
   @ApiOperation({
      operationId: 'updateProductStatus',
      summary: 'Activate or deactivate product sales (Supplier owner)',
      description: 'Allows supplier to activate/pause product selling. Can ONLY be activated after ADMIN approval.',
   })
   @ApiParam({
      name: 'productId',
      description: 'Unique product identifier UUID',
   })
   @ApiResponse({
      status: HttpStatus.OK,
      description: 'Product status updated successfully.',
      type: ProductItemDto,
   })
   @ApiErrorResponses([
      {
         status: HttpStatus.BAD_REQUEST,
         description: 'Cannot activate unapproved product',
         errorCodes: [PRODUCT_ERROR_CODES.CANNOT_ACTIVATE_UNAPPROVED_PRODUCT],
      },
      {
         status: HttpStatus.NOT_FOUND,
         description: 'Product not found',
         errorCodes: [PRODUCT_ERROR_CODES.PRODUCT_NOT_FOUND],
      },
   ])
   @ResponseMessage(PRODUCT_RESPONSE_MESSAGES.UPDATE_STATUS_SUCCESS)
   async updateProductStatus(
      @Param('productId', UUID_PARAM_PIPE) productId: string,
      @Body() dto: UpdateProductStatusDto,
      @Req() req: Request,
      @CurrentUser() user?: JwtPayload,
   ): Promise<ProductItemDto> {
      const correlationId = (req.headers[CORRELATION_ID_HEADER] as string) || undefined;
      return this.productsService.updateProductStatus(productId, dto, {
         correlationId,
         accountId: user?.sub,
         roles: user?.roles,
         permissions: user?.permissions,
         email: user?.email,
      });
   }

   @Post('variants/:variantId/stock')
   @ApiCookieAuth()
   @ApiBearerAuth()
   @HttpCode(HttpStatus.OK)
   @ApiOperation({
      operationId: 'adjustStock',
      summary: 'Adjust warehouse stock level for a product variant',
      description: 'Supplier updates physical on-hand inventory levels for a specific product packaging variant.',
   })
   @ApiParam({
      name: 'variantId',
      description: 'Target packaging variant UUID',
   })
   @ApiResponse({
      status: HttpStatus.OK,
      description: 'Stock updated successfully.',
   })
   @ApiErrorResponses([
      {
         status: HttpStatus.BAD_REQUEST,
         description: 'Insufficient stock or invalid delta',
         errorCodes: [PRODUCT_ERROR_CODES.STOCK_INSUFFICIENT],
      },
      {
         status: HttpStatus.NOT_FOUND,
         description: 'Variant not found',
         errorCodes: [PRODUCT_ERROR_CODES.VARIANT_NOT_FOUND],
      },
   ])
   @ResponseMessage(PRODUCT_RESPONSE_MESSAGES.ADJUST_STOCK_SUCCESS)
   async adjustStock(
      @Param('variantId', UUID_PARAM_PIPE) variantId: string,
      @Body() dto: AdjustStockDto,
      @Req() req: Request,
      @CurrentUser() user?: JwtPayload,
   ) {
      const correlationId = (req.headers[CORRELATION_ID_HEADER] as string) || undefined;
      return this.productsService.adjustStock(variantId, dto, {
         correlationId,
         accountId: user?.sub,
         roles: user?.roles,
         permissions: user?.permissions,
         email: user?.email,
      });
   }

   @Post('stock/reserve')
   @ApiCookieAuth()
   @ApiBearerAuth()
   @HttpCode(HttpStatus.OK)
   @ApiOperation({
      operationId: 'checkAndReserveStock',
      summary: 'Check and reserve inventory stock for an order',
      description: 'Internal and order checkout stock reservation lock.',
   })
   @ApiResponse({
      status: HttpStatus.OK,
      description: 'Reservation evaluation result.',
      type: CheckAndReserveStockResponseDto,
   })
   @ResponseMessage(PRODUCT_RESPONSE_MESSAGES.RESERVE_STOCK_SUCCESS)
   async checkAndReserveStock(
      @Body() dto: CheckAndReserveStockDto,
      @Req() req: Request,
      @CurrentUser() user?: JwtPayload,
   ): Promise<CheckAndReserveStockResponseDto> {
      const correlationId = (req.headers[CORRELATION_ID_HEADER] as string) || undefined;
      return this.productsService.checkAndReserveStock(dto, {
         correlationId,
         accountId: user?.sub,
         roles: user?.roles,
         permissions: user?.permissions,
         email: user?.email,
      });
   }

   @Post('stock/release')
   @ApiCookieAuth()
   @ApiBearerAuth()
   @HttpCode(HttpStatus.OK)
   @ApiOperation({
      operationId: 'releaseStock',
      summary: 'Release reserved inventory stock back to on-hand',
      description: 'Invoked upon order cancellation or checkout timeout.',
   })
   @ApiResponse({
      status: HttpStatus.OK,
      description: 'Stock released successfully.',
   })
   @ResponseMessage(PRODUCT_RESPONSE_MESSAGES.RELEASE_STOCK_SUCCESS)
   async releaseStock(
      @Body() dto: ReleaseStockDto,
      @Req() req: Request,
      @CurrentUser() user?: JwtPayload,
   ): Promise<{ success: boolean }> {
      const correlationId = (req.headers[CORRELATION_ID_HEADER] as string) || undefined;
      return this.productsService.releaseStock(dto, {
         correlationId,
         accountId: user?.sub,
         roles: user?.roles,
         permissions: user?.permissions,
         email: user?.email,
      });
   }
}
