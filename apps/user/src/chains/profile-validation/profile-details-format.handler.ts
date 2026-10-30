import { Injectable } from '@nestjs/common';
import { BadRequestException } from '@common';
import { USER_ERROR_CODES } from '@contracts/user';
import { Address, Bio, DateOfBirth, DisplayName, Website } from '@user/domain/value-objects';
import { AbstractProfileValidationHandler } from '@user/chains/profile-validation/abstract-profile-validation.handler';
import type { ProfileValidationContext } from '@user/chains/profile-validation/profile-validation.context';

/**
 * Validates domain invariants for profile content attributes (Display Name, Date of Birth,
 * Biography, Website URL, and Address) using domain Value Objects.
 */
@Injectable()
export class ProfileDetailsFormatHandler extends AbstractProfileValidationHandler {
   override async handle(context: ProfileValidationContext): Promise<void> {
      if (context.displayName !== undefined && context.displayName !== null && context.displayName !== '') {
         const displayNameResult = DisplayName.create(context.displayName);
         if (displayNameResult.isFailure()) {
            throw new BadRequestException(
               displayNameResult.getError() || USER_ERROR_CODES.INVALID_DISPLAY_NAME_FORMAT,
               {
                  params: displayNameResult.getParams(),
               },
            );
         }
      }

      if (context.dateOfBirth !== undefined && context.dateOfBirth !== null && context.dateOfBirth !== '') {
         const dobResult = DateOfBirth.create(context.dateOfBirth);
         if (dobResult.isFailure()) {
            throw new BadRequestException(dobResult.getError() || USER_ERROR_CODES.INVALID_DATE_OF_BIRTH, {
               params: dobResult.getParams(),
            });
         }
      }

      if (context.bio !== undefined && context.bio !== null) {
         const bioResult = Bio.create(context.bio);
         if (bioResult.isFailure()) {
            throw new BadRequestException(bioResult.getError() || USER_ERROR_CODES.INVALID_BIO, {
               params: bioResult.getParams(),
            });
         }
      }

      if (context.website !== undefined && context.website !== null) {
         const websiteResult = Website.create(context.website);
         if (websiteResult.isFailure()) {
            throw new BadRequestException(websiteResult.getError() || USER_ERROR_CODES.INVALID_WEBSITE, {
               params: websiteResult.getParams(),
            });
         }
      }

      if (context.address !== undefined && context.address !== null && context.address !== '') {
         const addressResult = Address.create(context.address);
         if (addressResult.isFailure()) {
            throw new BadRequestException(addressResult.getError() || USER_ERROR_CODES.INVALID_ADDRESS_FORMAT, {
               params: addressResult.getParams(),
            });
         }
      }

      return super.handle(context);
   }
}
