export class SupplierKybSubmittedEvent {
   constructor(
      public readonly supplierId: string,
      public readonly merchantType: string,
   ) {}
}
