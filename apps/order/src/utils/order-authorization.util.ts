import { status as GrpcStatus } from '@grpc/grpc-js';
import { RpcException } from '@nestjs/microservices';
import { COMMON_ERROR_CODES, isActorAdmin } from '@common';
import { ORDER_ERROR_CODES } from '@contracts/order';

export interface IOrderAuthOptions {
   isAdmin?: boolean;
}

/**
 * Resolves whether the caller possesses administrative privileges.
 * Supports explicit option flag, gRPC Metadata, or AsyncLocalStorage trace context.
 */
export function resolveIsAdmin(contextOrMetadata?: unknown): boolean {
   if (!contextOrMetadata) {
      return isActorAdmin(undefined);
   }
   if (typeof contextOrMetadata === 'object' && contextOrMetadata !== null && 'isAdmin' in contextOrMetadata) {
      return Boolean((contextOrMetadata as { isAdmin?: boolean }).isAdmin);
   }
   return isActorAdmin(contextOrMetadata);
}

/**
 * Validates that userId is provided and non-empty.
 * Throws gRPC UNAUTHENTICATED (16) with message COMMON_ERROR_CODES.UNAUTHORIZED if absent or empty.
 */
export function validateOrderUserId(userId: string | undefined | null): asserts userId is string {
   if (!userId || userId.trim() === '') {
      throw new RpcException({
         code: GrpcStatus.UNAUTHENTICATED, // 16
         message: COMMON_ERROR_CODES.UNAUTHORIZED,
      });
   }
}

/**
 * Asserts that the caller is the order owner or an administrator.
 * Throws gRPC PERMISSION_DENIED (7) with message ORDER_ERROR_CODES.UNAUTHORIZED_ACCESS if unauthorized.
 */
export function assertOrderOwnershipOrAdmin(
   orderOwnerId: string,
   requestUserId: string,
   contextOrMetadata?: unknown,
): void {
   const isAdmin = resolveIsAdmin(contextOrMetadata);
   if (orderOwnerId !== requestUserId && !isAdmin) {
      throw new RpcException({
         code: GrpcStatus.PERMISSION_DENIED, // 7
         message: ORDER_ERROR_CODES.UNAUTHORIZED_ACCESS,
      });
   }
}
