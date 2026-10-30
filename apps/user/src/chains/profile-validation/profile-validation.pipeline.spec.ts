import { BadRequestException, ConflictException, ForbiddenException, COMMON_ERROR_CODES } from '@common';
import { USER_ERROR_CODES, USER_ERROR_REASONS } from '@contracts/user';
import { PROFILE_OPERATIONS } from '@user/constants';
import { UserEntity, UserStatus } from '@user/entities';
import { UserActiveSpecification } from '@user/domain/specifications';
import {
   ProfileValidationPipeline,
   ProfileIdentityHandler,
   UsernameFormatHandler,
   ProfileDetailsFormatHandler,
   UsernameAvailabilityHandler,
   type ProfileValidationContext,
} from '@user/chains/profile-validation';

describe('ProfileValidationPipeline & Chain Handlers', () => {
   describe('ProfileIdentityHandler', () => {
      let handler: ProfileIdentityHandler;
      let mockProfileQueryService: { getUserById: jest.Mock };
      let userActiveSpec: UserActiveSpecification;

      beforeEach(() => {
         mockProfileQueryService = {
            getUserById: jest.fn(),
         };
         userActiveSpec = new UserActiveSpecification();
         handler = new ProfileIdentityHandler(mockProfileQueryService as any, userActiveSpec);
      });

      it('should throw BadRequestException if accountId is missing on CREATE', async () => {
         const context: ProfileValidationContext = {
            operation: PROFILE_OPERATIONS.CREATE,
         };

         await expect(handler.handle(context)).rejects.toThrow(BadRequestException);
         await expect(handler.handle(context)).rejects.toMatchObject({
            response: expect.objectContaining({
               errorCode: USER_ERROR_CODES.USER_ID_REQUIRED,
            }),
         });
      });

      it('should pass if accountId is present on CREATE', async () => {
         const context: ProfileValidationContext = {
            operation: PROFILE_OPERATIONS.CREATE,
            accountId: 'acc-123',
         };

         await expect(handler.handle(context)).resolves.toBeUndefined();
      });

      it('should throw BadRequestException if userId is missing on UPDATE', async () => {
         const context: ProfileValidationContext = {
            operation: PROFILE_OPERATIONS.UPDATE,
         };

         await expect(handler.handle(context)).rejects.toThrow(BadRequestException);
         await expect(handler.handle(context)).rejects.toMatchObject({
            response: expect.objectContaining({
               errorCode: USER_ERROR_CODES.USER_ID_REQUIRED,
            }),
         });
      });

      it('should throw BadRequestException if target user is not active on UPDATE', async () => {
         const inactiveUser = new UserEntity({
            userId: 'usr-1',
            accountId: 'acc-1',
            status: UserStatus.SUSPENDED,
         });
         mockProfileQueryService.getUserById.mockResolvedValue(inactiveUser);

         const context: ProfileValidationContext = {
            operation: PROFILE_OPERATIONS.UPDATE,
            userId: 'usr-1',
         };

         await expect(handler.handle(context)).rejects.toThrow(BadRequestException);
         await expect(handler.handle(context)).rejects.toMatchObject({
            response: expect.objectContaining({
               errorCode: USER_ERROR_CODES.USER_NOT_ACTIVE,
            }),
         });
      });

      it('should throw ForbiddenException if actor is not the owner nor admin', async () => {
         const activeUser = new UserEntity({
            userId: 'usr-1',
            accountId: 'owner-account-id',
            status: UserStatus.ACTIVE,
         });
         mockProfileQueryService.getUserById.mockResolvedValue(activeUser);

         const context: ProfileValidationContext = {
            operation: PROFILE_OPERATIONS.UPDATE,
            userId: 'usr-1',
            actorAccountId: 'intruder-account-id',
            isActorAdmin: false,
         };

         await expect(handler.handle(context)).rejects.toThrow(ForbiddenException);
         await expect(handler.handle(context)).rejects.toMatchObject({
            response: expect.objectContaining({
               errorCode: COMMON_ERROR_CODES.FORBIDDEN,
            }),
         });
      });

      it('should pass and attach existingUser if actor is owner or admin', async () => {
         const activeUser = new UserEntity({
            userId: 'usr-1',
            accountId: 'owner-account-id',
            status: UserStatus.ACTIVE,
         });
         mockProfileQueryService.getUserById.mockResolvedValue(activeUser);

         const context: ProfileValidationContext = {
            operation: PROFILE_OPERATIONS.UPDATE,
            userId: 'usr-1',
            actorAccountId: 'owner-account-id',
         };

         await expect(handler.handle(context)).resolves.toBeUndefined();
         expect(context.existingUser).toEqual(activeUser);
      });
   });

   describe('UsernameFormatHandler', () => {
      let handler: UsernameFormatHandler;

      beforeEach(() => {
         handler = new UsernameFormatHandler();
      });

      it('should pass and normalize username when valid', async () => {
         const context: ProfileValidationContext = {
            operation: PROFILE_OPERATIONS.CREATE,
            accountId: 'acc-1',
            username: '  Valid_Username.1  ',
         };

         await handler.handle(context);
         expect(context.normalizedUsername).toBe('valid_username.1');
      });

      it('should throw BadRequestException when username format is invalid', async () => {
         const context: ProfileValidationContext = {
            operation: PROFILE_OPERATIONS.CREATE,
            accountId: 'acc-1',
            username: 'invalid..username',
         };

         await expect(handler.handle(context)).rejects.toThrow(BadRequestException);
         await expect(handler.handle(context)).rejects.toMatchObject({
            response: expect.objectContaining({
               errorCode: USER_ERROR_CODES.INVALID_USERNAME_FORMAT,
            }),
         });
      });
   });

   describe('ProfileDetailsFormatHandler', () => {
      let handler: ProfileDetailsFormatHandler;

      beforeEach(() => {
         handler = new ProfileDetailsFormatHandler();
      });

      it('should throw BadRequestException when displayName is invalid', async () => {
         const context: ProfileValidationContext = {
            operation: PROFILE_OPERATIONS.CREATE,
            displayName: 'A', // min is 2
         };

         await expect(handler.handle(context)).rejects.toThrow(BadRequestException);
         await expect(handler.handle(context)).rejects.toMatchObject({
            response: expect.objectContaining({
               errorCode: USER_ERROR_CODES.INVALID_DISPLAY_NAME_FORMAT,
               params: expect.objectContaining({ reason: USER_ERROR_REASONS.MIN_LENGTH }),
            }),
         });
      });

      it('should throw BadRequestException when dateOfBirth is in future', async () => {
         const context: ProfileValidationContext = {
            operation: PROFILE_OPERATIONS.CREATE,
            dateOfBirth: new Date(Date.now() + 86400000 * 30),
         };

         await expect(handler.handle(context)).rejects.toThrow(BadRequestException);
         await expect(handler.handle(context)).rejects.toMatchObject({
            response: expect.objectContaining({
               errorCode: USER_ERROR_CODES.INVALID_DATE_OF_BIRTH,
               params: expect.objectContaining({ reason: USER_ERROR_REASONS.FUTURE_DATE }),
            }),
         });
      });

      it('should throw BadRequestException when bio exceeds 500 characters', async () => {
         const context: ProfileValidationContext = {
            operation: PROFILE_OPERATIONS.CREATE,
            bio: 'x'.repeat(501),
         };

         await expect(handler.handle(context)).rejects.toThrow(BadRequestException);
         await expect(handler.handle(context)).rejects.toMatchObject({
            response: expect.objectContaining({
               errorCode: USER_ERROR_CODES.INVALID_BIO,
               params: expect.objectContaining({ reason: USER_ERROR_REASONS.MAX_LENGTH }),
            }),
         });
      });

      it('should throw BadRequestException when website URL is invalid', async () => {
         const context: ProfileValidationContext = {
            operation: PROFILE_OPERATIONS.CREATE,
            website: 'invalid-url',
         };

         await expect(handler.handle(context)).rejects.toThrow(BadRequestException);
         await expect(handler.handle(context)).rejects.toMatchObject({
            response: expect.objectContaining({
               errorCode: USER_ERROR_CODES.INVALID_WEBSITE,
               params: expect.objectContaining({ reason: USER_ERROR_REASONS.INVALID_PROTOCOL_OR_FORMAT }),
            }),
         });
      });

      it('should throw BadRequestException when address is invalid', async () => {
         const context: ProfileValidationContext = {
            operation: PROFILE_OPERATIONS.CREATE,
            address: 'ab',
         };

         await expect(handler.handle(context)).rejects.toThrow(BadRequestException);
         await expect(handler.handle(context)).rejects.toMatchObject({
            response: expect.objectContaining({
               errorCode: USER_ERROR_CODES.INVALID_ADDRESS_FORMAT,
               params: expect.objectContaining({ reason: USER_ERROR_REASONS.MIN_LENGTH }),
            }),
         });
      });

      it('should pass when all attributes are valid', async () => {
         const context: ProfileValidationContext = {
            operation: PROFILE_OPERATIONS.CREATE,
            displayName: 'John Doe',
            dateOfBirth: '1995-10-10',
            bio: 'Software engineer',
            website: 'https://example.com',
            address: '123 Nguyen Trai, Hanoi',
         };

         await expect(handler.handle(context)).resolves.toBeUndefined();
      });
   });

   describe('UsernameAvailabilityHandler', () => {
      let handler: UsernameAvailabilityHandler;
      let mockBloomFilter: { mightContain: jest.Mock };
      let mockRepo: { findByUsername: jest.Mock };

      beforeEach(() => {
         mockBloomFilter = { mightContain: jest.fn() };
         mockRepo = { findByUsername: jest.fn() };
         handler = new UsernameAvailabilityHandler(mockBloomFilter as any, mockRepo as any);
      });

      it('should pass without database lookup if Bloom filter returns false', async () => {
         mockBloomFilter.mightContain.mockResolvedValue(false);

         const context: ProfileValidationContext = {
            operation: PROFILE_OPERATIONS.CREATE,
            username: 'unique_user',
            normalizedUsername: 'unique_user',
         };

         await expect(handler.handle(context)).resolves.toBeUndefined();
         expect(mockBloomFilter.mightContain).toHaveBeenCalledWith('unique_user');
         expect(mockRepo.findByUsername).not.toHaveBeenCalled();
      });

      it('should throw ConflictException if username is taken in database', async () => {
         mockBloomFilter.mightContain.mockResolvedValue(true);
         mockRepo.findByUsername.mockResolvedValue(new UserEntity({ userId: 'other-user', username: 'taken_user' }));

         const context: ProfileValidationContext = {
            operation: PROFILE_OPERATIONS.CREATE,
            username: 'taken_user',
            normalizedUsername: 'taken_user',
         };

         await expect(handler.handle(context)).rejects.toThrow(ConflictException);
         await expect(handler.handle(context)).rejects.toMatchObject({
            response: expect.objectContaining({
               errorCode: USER_ERROR_CODES.USERNAME_ALREADY_TAKEN,
            }),
         });
      });

      it('should bypass uniqueness check on UPDATE if username is unchanged', async () => {
         const existingUser = new UserEntity({ userId: 'u1', username: 'same_user' });

         const context: ProfileValidationContext = {
            operation: PROFILE_OPERATIONS.UPDATE,
            userId: 'u1',
            username: 'same_user',
            normalizedUsername: 'same_user',
            existingUser,
         };

         await expect(handler.handle(context)).resolves.toBeUndefined();
         expect(mockBloomFilter.mightContain).not.toHaveBeenCalled();
      });
   });

   describe('ProfileValidationPipeline (Full Integration)', () => {
      it('should execute all handlers in sequence successfully', async () => {
         const mockProfileQuery = {
            getUserById: jest.fn().mockResolvedValue(
               new UserEntity({
                  userId: 'u1',
                  accountId: 'acc1',
                  username: 'alex',
                  status: UserStatus.ACTIVE,
               }),
            ),
         };
         const mockBloomFilter = { mightContain: jest.fn().mockResolvedValue(false) };
         const mockRepo = { findByUsername: jest.fn() };

         const pipeline = new ProfileValidationPipeline([
            new ProfileIdentityHandler(mockProfileQuery as any),
            new UsernameFormatHandler(),
            new ProfileDetailsFormatHandler(),
            new UsernameAvailabilityHandler(mockBloomFilter as any, mockRepo as any),
         ]);

         const context: ProfileValidationContext = {
            operation: PROFILE_OPERATIONS.UPDATE,
            userId: 'u1',
            username: 'alex_new',
            displayName: 'Alex New',
            bio: 'New bio',
            website: 'https://alex.dev',
         };

         await expect(pipeline.validate(context)).resolves.toBeUndefined();
         expect(context.normalizedUsername).toBe('alex_new');
         expect(mockBloomFilter.mightContain).toHaveBeenCalledWith('alex_new');
      });
   });
});
