import { RegisterSupplierHandler } from '@supplier/commands/register-supplier.handler';
import { UpdateSupplierHandler } from '@supplier/commands/update-supplier.handler';
import { UpdateSupplierStatusHandler } from '@supplier/commands/update-supplier-status.handler';
import { VerifySupplierHandler } from '@supplier/commands/verify-supplier.handler';
import { HandleSupplierRegisteredHandler } from '@supplier/commands/handle-supplier-registered.handler';

export * from '@supplier/commands/register-supplier.command';
export * from '@supplier/commands/register-supplier.handler';
export * from '@supplier/commands/update-supplier.command';
export * from '@supplier/commands/update-supplier.handler';
export * from '@supplier/commands/update-supplier-status.command';
export * from '@supplier/commands/update-supplier-status.handler';
export * from '@supplier/commands/verify-supplier.command';
export * from '@supplier/commands/verify-supplier.handler';
export * from '@supplier/commands/handle-supplier-registered.command';
export * from '@supplier/commands/handle-supplier-registered.handler';

export const SUPPLIER_COMMAND_HANDLERS = [
   RegisterSupplierHandler,
   UpdateSupplierHandler,
   UpdateSupplierStatusHandler,
   VerifySupplierHandler,
   HandleSupplierRegisteredHandler,
];
