import { Injectable } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@common';
import type { CheckAndReserveStockResponseDto, ProductItemDto, WhoCategoryDto } from '@contracts/product';
import { ProductService, StockService } from '@product/services';
import {
   AdjustStockCommand,
   CheckAndReserveStockCommand,
   CreateProductCommand,
   GetProductByIdQuery,
   GetProductsByIdsQuery,
   ListProductsQuery,
   ListWhoCategoriesQuery,
   ModerateProductCommand,
   ReleaseStockCommand,
   UpdateProductCommand,
   UpdateProductStatusCommand,
} from './product.commands';

@Injectable()
@CommandHandler(CreateProductCommand)
export class CreateProductHandler implements ICommandHandler<CreateProductCommand, ProductItemDto> {
   constructor(private readonly productService: ProductService) {}

   async execute(command: CreateProductCommand): Promise<ProductItemDto> {
      return this.productService.createProduct(command.supplierId, command.dto);
   }
}

@Injectable()
@CommandHandler(UpdateProductCommand)
export class UpdateProductHandler implements ICommandHandler<UpdateProductCommand, ProductItemDto> {
   constructor(private readonly productService: ProductService) {}

   async execute(command: UpdateProductCommand): Promise<ProductItemDto> {
      return this.productService.updateProduct(command.productId, command.supplierId, command.dto);
   }
}

@Injectable()
@CommandHandler(ModerateProductCommand)
export class ModerateProductHandler implements ICommandHandler<ModerateProductCommand, ProductItemDto> {
   constructor(private readonly productService: ProductService) {}

   async execute(command: ModerateProductCommand): Promise<ProductItemDto> {
      return this.productService.moderateProduct(command.productId, command.moderatorId, command.dto);
   }
}

@Injectable()
@CommandHandler(UpdateProductStatusCommand)
export class UpdateProductStatusHandler implements ICommandHandler<UpdateProductStatusCommand, ProductItemDto> {
   constructor(private readonly productService: ProductService) {}

   async execute(command: UpdateProductStatusCommand): Promise<ProductItemDto> {
      return this.productService.updateProductStatus(command.productId, command.supplierId, command.dto);
   }
}

@Injectable()
@CommandHandler(AdjustStockCommand)
export class AdjustStockHandler implements ICommandHandler<
   AdjustStockCommand,
   { variantId: string; newStockQuantity: number }
> {
   constructor(private readonly stockService: StockService) {}

   async execute(command: AdjustStockCommand): Promise<{ variantId: string; newStockQuantity: number }> {
      return this.stockService.adjustStock(command.variantId, command.dto);
   }
}

@Injectable()
@CommandHandler(CheckAndReserveStockCommand)
export class CheckAndReserveStockHandler implements ICommandHandler<
   CheckAndReserveStockCommand,
   CheckAndReserveStockResponseDto
> {
   constructor(private readonly stockService: StockService) {}

   async execute(command: CheckAndReserveStockCommand): Promise<CheckAndReserveStockResponseDto> {
      return this.stockService.checkAndReserveStock(command.dto);
   }
}

@Injectable()
@CommandHandler(ReleaseStockCommand)
export class ReleaseStockHandler implements ICommandHandler<
   ReleaseStockCommand,
   { success: boolean; orderId: string }
> {
   constructor(private readonly stockService: StockService) {}

   async execute(command: ReleaseStockCommand): Promise<{ success: boolean; orderId: string }> {
      return this.stockService.releaseStock(command.dto);
   }
}

@Injectable()
@CommandHandler(GetProductByIdQuery)
export class GetProductByIdHandler implements ICommandHandler<GetProductByIdQuery, ProductItemDto> {
   constructor(private readonly productService: ProductService) {}

   async execute(command: GetProductByIdQuery): Promise<ProductItemDto> {
      return this.productService.getProductById(command.productId);
   }
}

@Injectable()
@CommandHandler(GetProductsByIdsQuery)
export class GetProductsByIdsHandler implements ICommandHandler<GetProductsByIdsQuery, ProductItemDto[]> {
   constructor(private readonly productService: ProductService) {}

   async execute(command: GetProductsByIdsQuery): Promise<ProductItemDto[]> {
      return this.productService.getProductsByIds(command.productIds);
   }
}

@Injectable()
@CommandHandler(ListProductsQuery)
export class ListProductsHandler implements ICommandHandler<
   ListProductsQuery,
   { items: ProductItemDto[]; total: number }
> {
   constructor(private readonly productService: ProductService) {}

   async execute(command: ListProductsQuery): Promise<{ items: ProductItemDto[]; total: number }> {
      return this.productService.listProducts(command.query);
   }
}

@Injectable()
@CommandHandler(ListWhoCategoriesQuery)
export class ListWhoCategoriesHandler implements ICommandHandler<ListWhoCategoriesQuery, WhoCategoryDto[]> {
   constructor(private readonly productService: ProductService) {}

   async execute(): Promise<WhoCategoryDto[]> {
      const categories = await this.productService.listWhoCategories();
      return categories.map((c) => ({
         code: c.code as never,
         name: c.name,
         description: c.description,
         examples: c.examples,
         order: c.order,
      }));
   }
}
