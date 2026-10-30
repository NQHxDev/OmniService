import { Command, type IServiceMessage } from '@common';
import type { Gender, UserEntity } from '@user/entities';

export interface UpdateUserProfileDto {
   userId: string;
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
}

export class UpdateUserProfileCommand extends Command<UserEntity> {
   constructor(public readonly message: IServiceMessage<UpdateUserProfileDto>) {
      super();
   }
}
