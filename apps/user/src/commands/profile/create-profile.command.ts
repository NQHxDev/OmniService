import { Command, type IServiceMessage } from '@common';
import type { Gender, UserEntity } from '@user/entities';

export interface CreateProfileDto {
   username?: string;
   displayName?: string;
   gender?: Gender;
   dateOfBirth?: string | Date;
   bio?: string;
   avatar?: string;
   coverImage?: string;
   website?: string;
   location?: string;
   address?: string;
   accountId?: string;
   userId?: string;
}

export class CreateProfileCommand extends Command<UserEntity> {
   constructor(public readonly message: IServiceMessage<CreateProfileDto>) {
      super();
   }
}
