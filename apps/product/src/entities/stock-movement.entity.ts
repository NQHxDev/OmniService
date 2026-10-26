export class StockMovementEntity {
   movementId!: string;
   variantId!: string;
   movementType!: string;
   quantity!: number;
   balanceAfter!: number;
   referenceType?: string | null;
   referenceId?: string | null;
   reason?: string | null;
   createdAt!: Date;
}
