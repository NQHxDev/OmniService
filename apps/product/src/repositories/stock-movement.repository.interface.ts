import { StockMovementEntity } from '@product/entities';

export const STOCK_MOVEMENT_REPOSITORY = Symbol('STOCK_MOVEMENT_REPOSITORY');

export interface CreateStockMovementInput {
   variantId: string;
   movementType: string;
   quantity: number;
   balanceAfter: number;
   referenceType?: string;
   referenceId?: string;
   reason?: string;
}

export interface IStockMovementRepository {
   create(input: CreateStockMovementInput): Promise<StockMovementEntity>;
   findByVariantId(variantId: string, limit?: number): Promise<StockMovementEntity[]>;
}
