import { Command } from '@common';
import type {
   AdjustStockDto,
   CheckAndReserveStockDto,
   CheckAndReserveStockResponseDto,
   CreateProductDto,
   ListProductsQueryDto,
   ModerateProductDto,
   ProductItemDto,
   ReleaseStockDto,
   UpdateProductDto,
   UpdateProductStatusDto,
   WhoCategoryDto,
} from '@contracts/product';

export class CreateProductCommand extends Command<ProductItemDto> {
   constructor(
      public readonly supplierId: string,
      public readonly dto: CreateProductDto,
   ) {
      super();
   }
}

export class UpdateProductCommand extends Command<ProductItemDto> {
   constructor(
      public readonly productId: string,
      public readonly supplierId: string,
      public readonly dto: UpdateProductDto,
   ) {
      super();
   }
}

export class ModerateProductCommand extends Command<ProductItemDto> {
   constructor(
      public readonly productId: string,
      public readonly moderatorId: string,
      public readonly dto: ModerateProductDto,
   ) {
      super();
   }
}

export class UpdateProductStatusCommand extends Command<ProductItemDto> {
   constructor(
      public readonly productId: string,
      public readonly supplierId: string,
      public readonly dto: UpdateProductStatusDto,
   ) {
      super();
   }
}

export class AdjustStockCommand extends Command<{ variantId: string; newStockQuantity: number }> {
   constructor(
      public readonly variantId: string,
      public readonly dto: AdjustStockDto,
   ) {
      super();
   }
}

export class CheckAndReserveStockCommand extends Command<CheckAndReserveStockResponseDto> {
   constructor(public readonly dto: CheckAndReserveStockDto) {
      super();
   }
}

export class ReleaseStockCommand extends Command<{ success: boolean; orderId: string }> {
   constructor(public readonly dto: ReleaseStockDto) {
      super();
   }
}

export class GetProductByIdQuery extends Command<ProductItemDto> {
   constructor(public readonly productId: string) {
      super();
   }
}

export class GetProductsByIdsQuery extends Command<ProductItemDto[]> {
   constructor(public readonly productIds: string[]) {
      super();
   }
}

export class ListProductsQuery extends Command<{
   items: ProductItemDto[];
   total: number;
}> {
   constructor(public readonly query: ListProductsQueryDto) {
      super();
   }
}

export class ListWhoCategoriesQuery extends Command<WhoCategoryDto[]> {
   constructor() {
      super();
   }
}
