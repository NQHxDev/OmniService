import type { UpdateUserData } from '@user/repositories/user-profile.repository';

/**
 * Type-safe field constants for Profile synchronization and change tracking.
 * Follows zero-hardcoding standards across OmniServices.
 */

export const USER_PROFILE_SYNC_FIELDS = {
   USERNAME: 'username',
   DISPLAY_NAME: 'displayName',
   BIO: 'bio',
   AVATAR: 'avatar',
   METADATA: 'metadata',
} as const;

export type UserProfileSyncField = (typeof USER_PROFILE_SYNC_FIELDS)[keyof typeof USER_PROFILE_SYNC_FIELDS];

/**
 * Individual metadata field keys for user profile.
 */
export const USER_METADATA_FIELDS = {
   WEBSITE: 'website',
   LOCATION: 'location',
   ADDRESS: 'address',
   GENDER: 'gender',
   DATE_OF_BIRTH: 'dateOfBirth',
   COVER_IMAGE: 'coverImage',
} as const;

export type UserMetadataField = (typeof USER_METADATA_FIELDS)[keyof typeof USER_METADATA_FIELDS];

/**
 * Array of metadata fields to check during profile synchronization,
 * constrained to valid keys of UpdateUserData.
 */
export const PROFILE_METADATA_FIELDS = [
   USER_METADATA_FIELDS.WEBSITE,
   USER_METADATA_FIELDS.LOCATION,
   USER_METADATA_FIELDS.ADDRESS,
   USER_METADATA_FIELDS.GENDER,
   USER_METADATA_FIELDS.DATE_OF_BIRTH,
   USER_METADATA_FIELDS.COVER_IMAGE,
] as const satisfies readonly (keyof UpdateUserData)[];

export type ProfileMetadataField = (typeof PROFILE_METADATA_FIELDS)[number];
