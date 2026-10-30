import type { Gender, UserEntity } from '@user/entities';
import type { ProfileOperation } from '@user/constants';

export interface ProfileValidationContext {
   readonly operation: ProfileOperation;
   readonly accountId?: string;
   readonly userId?: string;
   readonly username?: string | null;
   readonly displayName?: string | null;
   readonly bio?: string | null;
   readonly avatar?: string | null;
   readonly coverImage?: string | null;
   readonly website?: string | null;
   readonly location?: string | null;
   readonly address?: string | null;
   readonly dateOfBirth?: Date | string | number | null;
   readonly gender?: Gender | null;
   readonly actorAccountId?: string;
   readonly isActorAdmin?: boolean;

   // Enriched attributes throughout the chain execution
   normalizedUsername?: string | null;
   existingUser?: UserEntity | null;
}
