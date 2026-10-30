import {
   AdjustStockHandler,
   CheckAndReserveStockHandler,
   CreateProductHandler,
   GetProductByIdHandler,
   GetProductModerationHistoryHandler,
   GetProductsByIdsHandler,
   ListProductsHandler,
   ListWhoCategoriesHandler,
   ModerateProductHandler,
   ReleaseStockHandler,
   SubmitProductForReviewHandler,
   UpdateProductHandler,
   UpdateProductStatusHandler,
} from '@product/commands/product.handlers';

export * from '@product/commands/product.commands';
export * from '@product/commands/product.handlers';

export const PRODUCT_COMMAND_HANDLERS = [
   CreateProductHandler,
   UpdateProductHandler,
   SubmitProductForReviewHandler,
   ModerateProductHandler,
   GetProductModerationHistoryHandler,
   UpdateProductStatusHandler,
   AdjustStockHandler,
   CheckAndReserveStockHandler,
   ReleaseStockHandler,
   GetProductByIdHandler,
   GetProductsByIdsHandler,
   ListProductsHandler,
   ListWhoCategoriesHandler,
];
