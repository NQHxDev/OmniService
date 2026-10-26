import { status as GrpcStatus } from '@grpc/grpc-js';
import { RpcException } from '@nestjs/microservices';
import { COMMON_ERROR_CODES, createGrpcMetadata, DEFAULT_ROLES } from '@common';
import { ORDER_ERROR_CODES } from '@contracts/order';
import {
   assertOrderOwnershipOrAdmin,
   resolveIsAdmin,
   validateOrderUserId,
} from '@order/utils/order-authorization.util';

describe('order-authorization.util', () => {
   describe('validateOrderUserId', () => {
      it('should pass when userId is a valid non-empty string', () => {
         expect(() => validateOrderUserId('user-123')).not.toThrow();
      });

      it('should throw RpcException UNAUTHENTICATED when userId is undefined', () => {
         try {
            validateOrderUserId(undefined);
            fail('Expected validateOrderUserId to throw');
         } catch (error) {
            expect(error).toBeInstanceOf(RpcException);
            const rpcError = (error as RpcException).getError() as { code: number; message: string };
            expect(rpcError.code).toBe(GrpcStatus.UNAUTHENTICATED);
            expect(rpcError.message).toBe(COMMON_ERROR_CODES.UNAUTHORIZED);
         }
      });

      it('should throw RpcException UNAUTHENTICATED when userId is empty string', () => {
         try {
            validateOrderUserId('');
            fail('Expected validateOrderUserId to throw');
         } catch (error) {
            expect(error).toBeInstanceOf(RpcException);
            const rpcError = (error as RpcException).getError() as { code: number; message: string };
            expect(rpcError.code).toBe(GrpcStatus.UNAUTHENTICATED);
            expect(rpcError.message).toBe(COMMON_ERROR_CODES.UNAUTHORIZED);
         }
      });

      it('should throw RpcException UNAUTHENTICATED when userId is whitespace string', () => {
         try {
            validateOrderUserId('   ');
            fail('Expected validateOrderUserId to throw');
         } catch (error) {
            expect(error).toBeInstanceOf(RpcException);
            const rpcError = (error as RpcException).getError() as { code: number; message: string };
            expect(rpcError.code).toBe(GrpcStatus.UNAUTHENTICATED);
            expect(rpcError.message).toBe(COMMON_ERROR_CODES.UNAUTHORIZED);
         }
      });
   });

   describe('resolveIsAdmin', () => {
      it('should return true when explicit isAdmin option is true', () => {
         expect(resolveIsAdmin({ isAdmin: true })).toBe(true);
      });

      it('should return false when explicit isAdmin option is false', () => {
         expect(resolveIsAdmin({ isAdmin: false })).toBe(false);
      });

      it('should return true when metadata contains ADMIN role', () => {
         const metadata = createGrpcMetadata({
            userId: 'admin-uuid',
            roles: [DEFAULT_ROLES.ADMIN],
         });
         expect(resolveIsAdmin(metadata)).toBe(true);
      });

      it('should return true when metadata contains SUPER_ADMIN role', () => {
         const metadata = createGrpcMetadata({
            userId: 'superadmin-uuid',
            roles: [DEFAULT_ROLES.SUPER_ADMIN],
         });
         expect(resolveIsAdmin(metadata)).toBe(true);
      });

      it('should return false when metadata contains only USER role', () => {
         const metadata = createGrpcMetadata({
            userId: 'user-uuid',
            roles: [DEFAULT_ROLES.USER],
         });
         expect(resolveIsAdmin(metadata)).toBe(false);
      });

      it('should return false when metadata has no roles', () => {
         const metadata = createGrpcMetadata({
            userId: 'user-uuid',
         });
         expect(resolveIsAdmin(metadata)).toBe(false);
      });

      it('should return false when context is undefined', () => {
         expect(resolveIsAdmin(undefined)).toBe(false);
      });
   });

   describe('assertOrderOwnershipOrAdmin', () => {
      it('should allow access when requestedUserId matches order owner', () => {
         expect(() => assertOrderOwnershipOrAdmin('owner-uuid', 'owner-uuid')).not.toThrow();
      });

      it('should allow access when caller has admin privilege via options', () => {
         expect(() => assertOrderOwnershipOrAdmin('owner-uuid', 'different-user', { isAdmin: true })).not.toThrow();
      });

      it('should allow access when caller has admin privilege via gRPC metadata', () => {
         const adminMetadata = createGrpcMetadata({
            userId: 'admin-uuid',
            roles: [DEFAULT_ROLES.ADMIN],
         });
         expect(() => assertOrderOwnershipOrAdmin('owner-uuid', 'admin-uuid', adminMetadata)).not.toThrow();
      });

      it('should throw RpcException PERMISSION_DENIED when caller is not owner and not admin (BOLA attempt)', () => {
         const userMetadata = createGrpcMetadata({
            userId: 'attacker-uuid',
            roles: [DEFAULT_ROLES.USER],
         });

         try {
            assertOrderOwnershipOrAdmin('owner-uuid', 'attacker-uuid', userMetadata);
            fail('Expected assertOrderOwnershipOrAdmin to throw');
         } catch (error) {
            expect(error).toBeInstanceOf(RpcException);
            const rpcError = (error as RpcException).getError() as { code: number; message: string };
            expect(rpcError.code).toBe(GrpcStatus.PERMISSION_DENIED);
            expect(rpcError.message).toBe(ORDER_ERROR_CODES.UNAUTHORIZED_ACCESS);
         }
      });
   });
});
