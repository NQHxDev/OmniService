import { v7, validate, version } from 'uuid';

export const UUID_V7_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Checks whether a given value is a valid UUIDv7 format.
 * Functions as a TypeScript type guard (value is string).
 */
export const isValidUuidV7 = (value: unknown): value is string =>
   typeof value === 'string' && validate(value) && version(value) === 7;

/**
 * Ergonomic alias for isValidUuidV7 used across services.
 */
export const isUuidV7 = isValidUuidV7;

/**
 * Checks whether a given value is a valid UUID format (v1-v7).
 * Functions as a TypeScript type guard (value is string).
 */
export const isValidUuid = (value: unknown): value is string => typeof value === 'string' && validate(value);

/**
 * Ergonomic alias for isValidUuid used across services.
 */
export const isUuid = isValidUuid;

/**
 * Generates an RFC 9562 compliant UUIDv7 string using the official standard 'uuid' library.
 */
export const uuidv7 = v7;
