import type { IDeviceInfo } from '@common';
import type { AccountEntity } from '@auth/entities';
import type { TokenPair } from '@auth/services/infrastructure';

/**
 * Common Saga interface representing rollback/compensation capability in authentication workflows.
 */
export interface IAuthSaga {
   setTokens(tokens: TokenPair): void;
   complete?(): Promise<void>;
   rollback(): Promise<void>;
}

/**
 * Result returned by the abstract authenticateOrProvision step.
 */
export interface AuthProvisionResult<TSaga extends IAuthSaga = IAuthSaga> {
   /**
    * The account authenticated or newly created.
    */
   account: AccountEntity;

   /**
    * Active saga maintaining compensation state.
    */
   saga: TSaga;

   /**
    * Resolved client IP address for audit and tracking.
    */
   clientIp?: string;

   /**
    * Explicit lastLoginAt ISO string (e.g., if updated during login provisioning).
    */
   lastLoginAt?: string | null;
}

/**
 * Immutable context object passed to template method hooks during authentication flow execution.
 */
export interface AuthFlowContext<TDto, TSaga extends IAuthSaga = IAuthSaga> {
   readonly dto: TDto;
   readonly deviceInfo?: IDeviceInfo;
   readonly clientIp: string;
   readonly account: AccountEntity;
   readonly roles: string[];
   readonly tokens: TokenPair;
   readonly saga: TSaga;
   readonly startTime: number;
   lastLoginAt?: string | null;
}
