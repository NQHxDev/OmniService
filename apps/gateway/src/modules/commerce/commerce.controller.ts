import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import {
   ApiErrorResponses,
   COMMON_ERROR_CODES,
   CORRELATION_ID_HEADER,
   CurrentUser,
   type JwtPayload,
   Public,
   ResponseMessage,
} from '@common';
import {
   CategoryItemDto,
   COMMERCE_ERROR_CODES,
   COMMERCE_RESPONSE_MESSAGES,
   CreateIngredientDto,
   CreateProductOfferDto,
   IngredientItemDto,
   IngredientSuppliersResponseDto,
   SearchIngredientsDto,
   SearchIngredientsResponseDto,
   SupplierProductOfferDto,
} from '@contracts/commerce';
import { CommerceService } from '@/modules/commerce/commerce.service';

@ApiTags('Commerce')
@Controller('commerce')
export class CommerceController {
   constructor(private readonly commerceService: CommerceService) {}

   @Get('ingredients')
   @Public()
   @HttpCode(HttpStatus.OK)
   @ApiOperation({
      operationId: 'searchIngredients',
      summary: 'Search and autocomplete standardized cooking ingredients',
      description:
         'Allows users creating cooking video posts to quickly search, filter, and pick standardized ingredients from the central catalog instead of typing raw unstandardized text.',
   })
   @ApiResponse({
      status: HttpStatus.OK,
      description: 'Matching ingredients retrieved successfully.',
      type: SearchIngredientsResponseDto,
   })
   @ApiErrorResponses([
      {
         status: HttpStatus.BAD_REQUEST,
         description: 'Invalid search parameters or pagination limits',
         errorCodes: [COMMON_ERROR_CODES.INVALID_REQUEST],
      },
   ])
   @ResponseMessage(COMMERCE_RESPONSE_MESSAGES.SEARCH_INGREDIENTS_SUCCESS)
   async searchIngredients(@Query() query: SearchIngredientsDto): Promise<SearchIngredientsResponseDto> {
      return this.commerceService.searchIngredients(query);
   }

   @Get('ingredients/categories')
   @Public()
   @HttpCode(HttpStatus.OK)
   @ApiOperation({
      operationId: 'listIngredientCategories',
      summary: 'Step 1/4: Get all standardized culinary ingredient categories',
      description: `### Workflow: Culinary Supply Chain (Step 1 of 4)
#### Prerequisites
- None (Public endpoint).

#### Process Flow
- Returns the catalog list of standardized culinary ingredient categories (Meat, Vegetables, Spices, Dairy, Seafood) for filtering options in the UI.

#### Next Step
- Query ingredients within a selected category via \`GET /api/v1/commerce/ingredients\`, or proceed to **Step 2/4** (\`POST /api/v1/commerce/ingredients\`) to propose a new ingredient.`,
   })
   @ApiResponse({
      status: HttpStatus.OK,
      description: 'Categories retrieved successfully.',
      type: [CategoryItemDto],
      links: {
         SearchIngredients: {
            operationId: 'searchIngredients',
            description: 'Search ingredients under a selected category',
         },
      },
   })
   @ResponseMessage(COMMERCE_RESPONSE_MESSAGES.LIST_CATEGORIES_SUCCESS)
   async listCategories(): Promise<CategoryItemDto[]> {
      return this.commerceService.listCategories();
   }

   @Get('ingredients/:ingredientId')
   @Public()
   @HttpCode(HttpStatus.OK)
   @ApiOperation({
      operationId: 'getIngredientById',
      summary: 'Get ingredient details and available offers',
      description: 'Retrieves complete metadata for an ingredient by its unique UUID.',
   })
   @ApiParam({
      name: 'ingredientId',
      description: 'Unique UUID identifier of the ingredient',
      example: '0192e21b-0002-7000-8000-000000000001',
   })
   @ApiResponse({
      status: HttpStatus.OK,
      description: 'Ingredient details retrieved successfully.',
      type: IngredientItemDto,
   })
   @ApiErrorResponses([
      {
         status: HttpStatus.NOT_FOUND,
         description: 'Ingredient not found in the catalog',
         errorCodes: [COMMERCE_ERROR_CODES.INGREDIENT_NOT_FOUND],
      },
   ])
   @ResponseMessage(COMMERCE_RESPONSE_MESSAGES.GET_INGREDIENT_SUCCESS)
   async getIngredientById(
      @Param('ingredientId') ingredientId: string,
   ): Promise<{ ingredient: IngredientItemDto; offers: SupplierProductOfferDto[] }> {
      return this.commerceService.getIngredientById(ingredientId);
   }

   @Get('ingredients/:ingredientId/suppliers')
   @Public()
   @HttpCode(HttpStatus.OK)
   @ApiOperation({
      operationId: 'getSuppliersByIngredient',
      summary: 'Step 4/4: Get available suppliers and purchasing offers for an ingredient',
      description: `### Workflow: Culinary Supply Chain (Step 4 of 4)
#### Prerequisites
- Ingredient ID from recipe post or catalog search.

#### Process Flow
- Enables viewers of recipe/dish videos to view all registered suppliers providing this ingredient with pricing, verified merchant badge, stock availability, and direct ordering links.`,
   })
   @ApiParam({
      name: 'ingredientId',
      description: 'Unique UUID identifier of the ingredient',
      example: '0192e21b-0002-7000-8000-000000000001',
   })
   @ApiQuery({
      name: 'inStockOnly',
      required: false,
      type: Boolean,
      description: 'Filter only suppliers with active in-stock inventory',
   })
   @ApiResponse({
      status: HttpStatus.OK,
      description: 'List of suppliers and product offers retrieved successfully.',
      type: IngredientSuppliersResponseDto,
   })
   @ApiErrorResponses([
      {
         status: HttpStatus.NOT_FOUND,
         description: 'Ingredient not found',
         errorCodes: [COMMERCE_ERROR_CODES.INGREDIENT_NOT_FOUND],
      },
   ])
   @ResponseMessage(COMMERCE_RESPONSE_MESSAGES.GET_SUPPLIERS_SUCCESS)
   async getSuppliersByIngredient(
      @Param('ingredientId') ingredientId: string,
      @Query('inStockOnly') inStockOnly?: boolean,
   ): Promise<IngredientSuppliersResponseDto> {
      return this.commerceService.getSuppliersByIngredient(ingredientId, Boolean(inStockOnly));
   }

   @Post('ingredients')
   @ApiBearerAuth()
   @ApiCookieAuth()
   @HttpCode(HttpStatus.CREATED)
   @ApiOperation({
      operationId: 'createIngredient',
      summary: 'Step 2/4: Create and propose standardized culinary ingredient in catalog',
      description: `### Workflow: Culinary Supply Chain (Step 2 of 4)
#### Prerequisites
- Requires Administrator role.

#### Process Flow
- Adds a new standardized ingredient entity to the central catalog with category reference, default unit, and nutritional metadata.

#### Next Step
- Suppliers can now link their store inventory to this ingredient via **Step 3/4** (\`POST /api/v1/commerce/products\`).`,
   })
   @ApiResponse({
      status: HttpStatus.CREATED,
      description: 'Ingredient created successfully.',
      type: IngredientItemDto,
      links: {
         GetIngredientById: {
            operationId: 'getIngredientById',
            description: 'Retrieve full metadata and offers for the newly created ingredient',
            parameters: {
               ingredientId: '$response.body#/data/id',
            },
         },
         CreateProductOffer: {
            operationId: 'createProductOffer',
            description: 'Step 3/4: Link merchant inventory to this ingredient',
            parameters: {
               ingredientId: '$response.body#/data/id',
            },
         },
      },
   })
   @ApiErrorResponses([
      {
         status: HttpStatus.BAD_REQUEST,
         description: 'Validation failure or invalid category ID',
         errorCodes: [COMMON_ERROR_CODES.INVALID_REQUEST, COMMERCE_ERROR_CODES.CATEGORY_NOT_FOUND],
      },
      {
         status: HttpStatus.UNAUTHORIZED,
         description: 'Authentication token is missing or invalid',
         errorCodes: [COMMON_ERROR_CODES.UNAUTHORIZED],
      },
      {
         status: HttpStatus.FORBIDDEN,
         description: 'Requires Administrator role',
         errorCodes: [COMMON_ERROR_CODES.FORBIDDEN],
      },
      {
         status: HttpStatus.CONFLICT,
         description: 'An ingredient with this name or slug already exists',
         errorCodes: [COMMERCE_ERROR_CODES.INGREDIENT_ALREADY_EXISTS],
      },
   ])
   @ResponseMessage(COMMERCE_RESPONSE_MESSAGES.CREATE_INGREDIENT_SUCCESS)
   async createIngredient(
      @Body() dto: CreateIngredientDto,
      @CurrentUser() user: JwtPayload,
      @Req() req: Request,
   ): Promise<IngredientItemDto> {
      const correlationId = req.headers[CORRELATION_ID_HEADER] as string | undefined;
      return this.commerceService.createIngredient(dto, { user, correlationId });
   }

   @Post('products')
   @ApiBearerAuth()
   @ApiCookieAuth()
   @HttpCode(HttpStatus.CREATED)
   @ApiOperation({
      operationId: 'createProductOffer',
      summary: 'Step 3/4: Create supplier product offer linking merchant inventory to standardized ingredient',
      description: `### Workflow: Culinary Supply Chain (Step 3 of 4)
#### Prerequisites
- Authenticated supplier owner or Administrator. Ingredient must exist in central catalog.

#### Process Flow
- Links merchant product SKU, pricing, packaging unit, stock availability, and online checkout URL to the standardized catalog ingredient.

#### Next Step
- Video viewers can discover and purchase this offer via **Step 4/4** (\`GET /api/v1/commerce/ingredients/:ingredientId/suppliers\`).`,
   })
   @ApiResponse({
      status: HttpStatus.CREATED,
      description: 'Product offer created successfully.',
      type: SupplierProductOfferDto,
      links: {
         GetSuppliersByIngredient: {
            operationId: 'getSuppliersByIngredient',
            description: 'Step 4/4: View all active supplier offers for this ingredient',
            parameters: {
               ingredientId: '$request.body#/ingredientId',
            },
         },
      },
   })
   @ApiErrorResponses([
      {
         status: HttpStatus.BAD_REQUEST,
         description: 'Validation failure',
         errorCodes: [COMMON_ERROR_CODES.INVALID_REQUEST],
      },
      {
         status: HttpStatus.UNAUTHORIZED,
         description: 'Authentication token is missing or invalid',
         errorCodes: [COMMON_ERROR_CODES.UNAUTHORIZED],
      },
      {
         status: HttpStatus.FORBIDDEN,
         description: 'Caller is not the supplier owner or Administrator',
         errorCodes: [COMMON_ERROR_CODES.FORBIDDEN, COMMON_ERROR_CODES.NOT_OWNER_OR_ADMIN],
      },
      {
         status: HttpStatus.NOT_FOUND,
         description: 'Supplier or ingredient not found',
         errorCodes: [COMMERCE_ERROR_CODES.SUPPLIER_NOT_FOUND, COMMERCE_ERROR_CODES.INGREDIENT_NOT_FOUND],
      },
      {
         status: HttpStatus.CONFLICT,
         description: 'Product offer with this SKU already exists for this supplier',
         errorCodes: [COMMERCE_ERROR_CODES.PRODUCT_OFFER_ALREADY_EXISTS],
      },
   ])
   @ResponseMessage(COMMERCE_RESPONSE_MESSAGES.CREATE_PRODUCT_SUCCESS)
   async createProductOffer(
      @Body() dto: CreateProductOfferDto,
      @CurrentUser() user: JwtPayload,
      @Req() req: Request,
   ): Promise<SupplierProductOfferDto> {
      const correlationId = req.headers[CORRELATION_ID_HEADER] as string | undefined;
      return this.commerceService.createProductOffer(dto, { user, correlationId });
   }
}
