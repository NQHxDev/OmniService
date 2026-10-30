export class SupplierRejectedEvent {
   constructor(
      public readonly supplierId: string,
      public readonly reason: string,
   ) {}
}
