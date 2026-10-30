import { Metadata, status as GrpcStatus } from '@grpc/grpc-js';
import { ArgumentsHost, HttpStatus } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { context as otelContext, propagation } from '@opentelemetry/api';
import { AppException } from '@common/exceptions/app.exception';
import { CORRELATION_ID_HEADER, REQUEST_ID_HEADER, SENSITIVE_LOG_KEYS } from '@common/logger/logger.constants';
import { GrpcTraceStorage, type IGrpcTraceContext } from '@common/interceptors/grpc-trace.storage';
import { uuidv7 } from '@common/utils/uuid.util';
import type { RoleCode } from '@common/constants/roles.constant';
import type { PermissionCode } from '@common/constants/permissions.constant';
import {
   GRPC_CONTEXT_RESERVED_KEY_SET,
   GRPC_METADATA_ALIASES,
   GRPC_METADATA_KEYS,
} from '@common/constants/grpc-metadata.constant';

const SENSITIVE_KEYS = new Set(SENSITIVE_LOG_KEYS.map((k) => k.toLowerCase()));

/**
 * Recursively sanitizes gRPC request/response payloads to prevent credentials from leaking into logs.
 */
export function sanitizeGrpcPayload(data: unknown): unknown {
   if (data === null || data === undefined || typeof data !== 'object') {
      return data;
   }

   if (Array.isArray(data)) {
      return data.map((item) => sanitizeGrpcPayload(item));
   }

   const sanitized: Record<string, unknown> = {};
   for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(key.toLowerCase())) {
         sanitized[key] = '***REDACTED***';
      } else if (typeof value === 'object' && value !== null) {
         sanitized[key] = sanitizeGrpcPayload(value);
      } else {
         sanitized[key] = value;
      }
   }
   return sanitized;
}

/**
 * Converts metadata value safely to string.
 */
function stringifyMetadataValue(value: unknown): string | undefined {
   if (typeof value === 'string') {
      return value;
   }
   if (Buffer.isBuffer(value)) {
      return value.toString('utf8');
   }
   if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
   }
   return undefined;
}

/**
 * Helper to safely retrieve the first matching value from aliases in a lowercased header map.
 */
export function getFirstMatchingHeader(map: Record<string, string>, aliases: readonly string[]): string | undefined {
   for (const alias of aliases) {
      const val = map[alias];
      if (val !== undefined && val !== '') {
         return val;
      }
   }
   return undefined;
}

/**
 * Extracts correlationId, caller service, and metadata map from gRPC ExecutionContext or ArgumentsHost.
 */
export function extractGrpcMetadata(context: ArgumentsHost): IGrpcTraceContext {
   const rpcContext = context.switchToRpc();
   const rawMetadata = rpcContext.getContext<Record<string, unknown>>();
   const metadataMap: Record<string, string> = {};
   let correlationId: string | undefined;

   if (rawMetadata && typeof rawMetadata === 'object') {
      const metadataObj = rawMetadata as {
         getMap?: () => Record<string, unknown>;
         get?: (key: string) => unknown[];
         [key: string]: unknown;
      };

      if (typeof metadataObj.getMap === 'function') {
         const map = metadataObj.getMap();
         for (const [k, v] of Object.entries(map)) {
            const strVal = stringifyMetadataValue(v);
            if (strVal !== undefined) {
               metadataMap[k.toLowerCase()] = strVal;
            }
         }
      } else {
         for (const [k, v] of Object.entries(metadataObj)) {
            const strVal = stringifyMetadataValue(v);
            if (strVal !== undefined) {
               metadataMap[k.toLowerCase()] = strVal;
            }
         }
      }

      if (typeof metadataObj.get === 'function') {
         const corrVal = metadataObj.get(CORRELATION_ID_HEADER);
         if (Array.isArray(corrVal) && corrVal.length > 0) {
            correlationId = stringifyMetadataValue(corrVal[0]);
         }
         if (!correlationId) {
            const reqVal = metadataObj.get(REQUEST_ID_HEADER);
            if (Array.isArray(reqVal) && reqVal.length > 0) {
               correlationId = stringifyMetadataValue(reqVal[0]);
            }
         }
      }
   }

   if (!correlationId) {
      correlationId = getFirstMatchingHeader(metadataMap, GRPC_METADATA_ALIASES.CORRELATION_ID) || uuidv7();
   }

   const callerService = getFirstMatchingHeader(metadataMap, GRPC_METADATA_ALIASES.CALLER_SERVICE);
   const userId = getFirstMatchingHeader(metadataMap, GRPC_METADATA_ALIASES.USER_ID);
   const requestId = getFirstMatchingHeader(metadataMap, GRPC_METADATA_ALIASES.REQUEST_ID);

   return {
      correlationId,
      requestId,
      userId,
      callerService,
      metadata: metadataMap,
   };
}

/**
 * Helper to convert various metadata objects (Metadata instance, ArgumentsHost, plain objects) into a lowercased string map.
 */
export function parseMetadataToMap(rawMetadata: unknown): Record<string, string> {
   const metadataMap: Record<string, string> = {};
   if (!rawMetadata || typeof rawMetadata !== 'object') {
      return metadataMap;
   }

   const metadataObj = rawMetadata as {
      getMap?: () => Record<string, unknown>;
      get?: (key: string) => unknown[];
      [key: string]: unknown;
   };

   if (typeof metadataObj.getMap === 'function') {
      const map = metadataObj.getMap();
      for (const [k, v] of Object.entries(map)) {
         const strVal = stringifyMetadataValue(v);
         if (strVal !== undefined) {
            metadataMap[k.toLowerCase()] = strVal;
         }
      }
   } else {
      for (const [k, v] of Object.entries(metadataObj)) {
         const strVal = stringifyMetadataValue(v);
         if (strVal !== undefined) {
            metadataMap[k.toLowerCase()] = strVal;
         }
      }
   }

   return metadataMap;
}

/**
 * Normalized user context extracted from gRPC Metadata, RabbitMQ message, or ExecutionContext.
 */
export interface IAuthUserContext {
   userId: string;
   email?: string;
   roles: RoleCode[];
   permissions: PermissionCode[];
   sessionId?: string;
   deviceId?: string;
}

function parseArrayField(val: unknown): string[] {
   if (!val) {
      return [];
   }
   if (Array.isArray(val)) {
      return val.map(String);
   }
   if (typeof val === 'string') {
      const trimmed = val.trim();
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
         try {
            const parsed: unknown = JSON.parse(trimmed);
            if (Array.isArray(parsed)) {
               return (parsed as unknown[]).map((item) => String(item));
            }
         } catch {
            // fallback to comma separated
         }
      }
      return trimmed
         .split(',')
         .map((s) => s.trim())
         .filter(Boolean);
   }
   return [];
}

/**
 * Extracts normalized user context (userId, roles, permissions, etc.) from gRPC Metadata,
 * execution context, service message, or AsyncLocalStorage trace storage.
 */
export function extractGrpcUser(source?: unknown): IAuthUserContext | undefined {
   if (!source) {
      const trace = GrpcTraceStorage.getTrace();
      if (!trace?.metadata) {
         return undefined;
      }
      return extractGrpcUser(trace.metadata);
   }

   // 1. If it's already an IAuthUserContext
   if (
      typeof source === 'object' &&
      source !== null &&
      'userId' in source &&
      'roles' in source &&
      Array.isArray((source as { roles: unknown }).roles)
   ) {
      const ctx = source as {
         userId: string;
         email?: string;
         roles: string[];
         permissions?: string[];
         sessionId?: string;
         deviceId?: string;
      };
      return {
         userId: ctx.userId,
         email: ctx.email,
         roles: ctx.roles,
         permissions: ctx.permissions || [],
         sessionId: ctx.sessionId,
         deviceId: ctx.deviceId,
      };
   }

   // 2. If it's an IServiceMessage with .user
   if (typeof source === 'object' && source !== null && 'user' in source) {
      const user = (source as { user?: unknown }).user;
      if (user) {
         return extractGrpcUser(user);
      }
   }

   // 3. If it's an ArgumentsHost / ExecutionContext
   let rawMetadata = source;
   if (
      typeof source === 'object' &&
      source !== null &&
      'switchToRpc' in source &&
      typeof (source as ArgumentsHost).switchToRpc === 'function'
   ) {
      rawMetadata = (source as ArgumentsHost).switchToRpc().getContext<Record<string, unknown>>();
   }

   const metadataMap = parseMetadataToMap(rawMetadata);

   const userId = getFirstMatchingHeader(metadataMap, GRPC_METADATA_ALIASES.USER_ID);

   if (!userId) {
      return undefined;
   }

   const rawRoles = getFirstMatchingHeader(metadataMap, GRPC_METADATA_ALIASES.USER_ROLES);
   const rawPermissions = getFirstMatchingHeader(metadataMap, GRPC_METADATA_ALIASES.USER_PERMISSIONS);
   const email = getFirstMatchingHeader(metadataMap, GRPC_METADATA_ALIASES.USER_EMAIL);
   const sessionId = getFirstMatchingHeader(metadataMap, GRPC_METADATA_ALIASES.SESSION_ID);
   const deviceId = getFirstMatchingHeader(metadataMap, GRPC_METADATA_ALIASES.DEVICE_ID);

   return {
      userId,
      email: email || undefined,
      roles: parseArrayField(rawRoles),
      permissions: parseArrayField(rawPermissions),
      sessionId: sessionId || undefined,
      deviceId: deviceId || undefined,
   };
}

export interface GrpcMetadataOptions {
   correlationId?: string;
   requestId?: string;
   userId?: string;
   accountId?: string;
   callerService?: string;
   roles?: string[] | readonly string[] | string;
   permissions?: string[] | readonly string[] | string;
   email?: string;
   [key: string]: unknown;
}

/**
 * Constructs a gRPC Metadata instance containing tracing and contextual headers.
 */
export function createGrpcMetadata(context?: GrpcMetadataOptions): Metadata {
   const metadata = new Metadata();
   const correlationId = context?.correlationId || uuidv7();
   metadata.set(CORRELATION_ID_HEADER, correlationId);

   // Inject W3C trace context (traceparent, tracestate) into gRPC metadata
   const traceCarrier: Record<string, string> = {};
   propagation.inject(otelContext.active(), traceCarrier);
   for (const [k, v] of Object.entries(traceCarrier)) {
      if (typeof v === 'string') {
         metadata.set(k.toLowerCase(), v);
      }
   }

   if (context?.requestId) {
      metadata.set(REQUEST_ID_HEADER, context.requestId);
   }

   const userObj =
      context?.user && typeof context.user === 'object' ? (context.user as Record<string, unknown>) : undefined;

   const resolvedUserId =
      context?.userId ||
      context?.accountId ||
      (userObj?.userId as string) ||
      (userObj?.accountId as string) ||
      (userObj?.sub as string);
   if (resolvedUserId) {
      metadata.set(GRPC_METADATA_KEYS.USER_ID, String(resolvedUserId));
   }
   const resolvedAccountId = context?.accountId || (userObj?.accountId as string);
   if (resolvedAccountId) {
      metadata.set(GRPC_METADATA_KEYS.ACCOUNT_ID, String(resolvedAccountId));
   }
   if (context?.callerService) {
      metadata.set(GRPC_METADATA_KEYS.CALLER_SERVICE, context.callerService);
   }
   const resolvedEmail = context?.email || (userObj?.email as string);
   if (resolvedEmail) {
      metadata.set(GRPC_METADATA_KEYS.USER_EMAIL, String(resolvedEmail));
      metadata.set(GRPC_METADATA_KEYS.EMAIL, String(resolvedEmail));
   }
   const resolvedRoles =
      context?.roles !== undefined ? context.roles : (userObj?.roles as string[] | string | undefined);
   if (resolvedRoles !== undefined) {
      const rolesStr = Array.isArray(resolvedRoles) ? JSON.stringify(resolvedRoles) : String(resolvedRoles);
      metadata.set(GRPC_METADATA_KEYS.USER_ROLES, rolesStr);
      metadata.set(GRPC_METADATA_KEYS.ROLES, rolesStr);
   }
   const resolvedPermissions =
      context?.permissions !== undefined
         ? context.permissions
         : (userObj?.permissions as string[] | string | undefined);
   if (resolvedPermissions !== undefined) {
      const permissionsStr = Array.isArray(resolvedPermissions)
         ? JSON.stringify(resolvedPermissions)
         : String(resolvedPermissions);
      metadata.set(GRPC_METADATA_KEYS.USER_PERMISSIONS, permissionsStr);
      metadata.set(GRPC_METADATA_KEYS.PERMISSIONS, permissionsStr);
   }

   if (context) {
      for (const [key, value] of Object.entries(context)) {
         if (value !== undefined && !GRPC_CONTEXT_RESERVED_KEY_SET.has(key)) {
            const headerKey = key.startsWith('x-') ? key.toLowerCase() : `x-${key.toLowerCase()}`;
            let headerVal: string | undefined;
            if (typeof value === 'string') {
               headerVal = value;
            } else if (typeof value === 'number' || typeof value === 'boolean') {
               headerVal = String(value);
            } else if (typeof value === 'object' && value !== null) {
               headerVal = JSON.stringify(value);
            }
            if (headerVal !== undefined) {
               metadata.set(headerKey, headerVal);
            }
         }
      }
   }

   return metadata;
}

/**
 * Maps HTTP status codes to standard gRPC status codes.
 */
export function mapHttpStatusToGrpc(httpStatus: HttpStatus): number {
   switch (httpStatus) {
      case HttpStatus.BAD_REQUEST:
      case HttpStatus.UNPROCESSABLE_ENTITY:
         return GrpcStatus.INVALID_ARGUMENT;
      case HttpStatus.UNAUTHORIZED:
         return GrpcStatus.UNAUTHENTICATED;
      case HttpStatus.FORBIDDEN:
         return GrpcStatus.PERMISSION_DENIED;
      case HttpStatus.NOT_FOUND:
         return GrpcStatus.NOT_FOUND;
      case HttpStatus.CONFLICT:
         return GrpcStatus.ALREADY_EXISTS;
      case HttpStatus.TOO_MANY_REQUESTS:
         return GrpcStatus.RESOURCE_EXHAUSTED;
      case HttpStatus.REQUEST_TIMEOUT:
         return GrpcStatus.DEADLINE_EXCEEDED;
      case HttpStatus.SERVICE_UNAVAILABLE:
         return GrpcStatus.UNAVAILABLE;
      default:
         return GrpcStatus.INTERNAL;
   }
}

/**
 * Maps standard gRPC status codes to corresponding HTTP status codes.
 */
export function mapGrpcStatusToHttpStatus(grpcStatus: GrpcStatus): HttpStatus {
   switch (grpcStatus) {
      case GrpcStatus.INVALID_ARGUMENT:
      case GrpcStatus.FAILED_PRECONDITION:
      case GrpcStatus.OUT_OF_RANGE:
         return HttpStatus.BAD_REQUEST;
      case GrpcStatus.UNAUTHENTICATED:
         return HttpStatus.UNAUTHORIZED;
      case GrpcStatus.PERMISSION_DENIED:
         return HttpStatus.FORBIDDEN;
      case GrpcStatus.NOT_FOUND:
         return HttpStatus.NOT_FOUND;
      case GrpcStatus.ALREADY_EXISTS:
         return HttpStatus.CONFLICT;
      case GrpcStatus.RESOURCE_EXHAUSTED:
         return HttpStatus.TOO_MANY_REQUESTS;
      case GrpcStatus.DEADLINE_EXCEEDED:
         return HttpStatus.REQUEST_TIMEOUT;
      case GrpcStatus.UNAVAILABLE:
         return HttpStatus.SERVICE_UNAVAILABLE;
      default:
         return HttpStatus.INTERNAL_SERVER_ERROR;
   }
}

/**
 * Extracts gRPC numerical code and string name from unknown thrown error.
 */
export function getGrpcStatusFromError(error: unknown): { code: number; statusName: string } {
   let code: number = GrpcStatus.INTERNAL;

   if (error instanceof AppException) {
      const payload = error.getPayload();
      code = mapHttpStatusToGrpc(payload.statusCode);
   } else if (error instanceof RpcException) {
      const err = error.getError();
      if (typeof err === 'object' && err !== null && typeof (err as { code?: number }).code === 'number') {
         code = (err as { code: number }).code;
      }
   } else if (typeof error === 'object' && error !== null && typeof (error as { code?: number }).code === 'number') {
      code = (error as { code: number }).code;
   }

   const statusName = (GrpcStatus[code] as string | undefined) || 'INTERNAL';
   return { code, statusName };
}
