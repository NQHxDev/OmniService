import {
   AdjustStockHandler,
   CheckAndReserveStockHandler,
   CreateProductHandler,
   GetProductByIdHandler,
   GetProductsByIdsHandler,
   ListProductsHandler,
   ListWhoCategoriesHandler,
   ModerateProductHandler,
   ReleaseStockHandler,
   UpdateProductHandler,
   UpdateProductStatusHandler,
} from './product.handlers';

export * from './product.commands';
export * from './product.handlers';

export const PRODUCT_COMMAND_HANDLERS = [
   CreateProductHandler,
   UpdateProductHandler,
   ModerateProductHandler,
   UpdateProductStatusHandler,
   AdjustStockHandler,
   CheckAndReserveStockHandler,
   ReleaseStockHandler,
   GetProductByIdHandler,
   GetProductsByIdsHandler,
   ListProductsHandler,
   ListWhoCategoriesHandler,
];
