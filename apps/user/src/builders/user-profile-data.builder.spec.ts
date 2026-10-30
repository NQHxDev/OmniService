import { BadRequestException } from '@common';
import { UserProfileDataBuilder } from '@user/builders/user-profile-data.builder';
import { Gender, UserStatus } from '@user/entities';

describe('UserProfileDataBuilder', () => {
   it('should build a valid CreateUserData payload with chained methods', () => {
      const dob = new Date('1995-05-15');
      const data = UserProfileDataBuilder.create()
         .withAccountId('acc-123')
         .withUsername('Alice_Wonder')
         .withDisplayName('Alice Wonder')
         .withBio('Adventures in Wonderland')
         .withAvatar('https://cdn.example.com/alice.png')
         .withCoverImage('https://cdn.example.com/cover.png')
         .withWebsite('https://alice.dev')
         .withLocation('London, UK')
         .withAddress('Baker Street 221B')
         .withGender(Gender.FEMALE)
         .withDateOfBirth(dob)
         .asVerified(true)
         .asPrivate(true)
         .withStatus(UserStatus.ACTIVE)
         .build();

      expect(data.accountId).toBe('acc-123');
      expect(data.username).toBe('alice_wonder'); // normalized to lowercase
      expect(data.displayName).toBe('Alice Wonder');
      expect(data.bio).toBe('Adventures in Wonderland');
      expect(data.avatar).toBe('https://cdn.example.com/alice.png');
      expect(data.coverImage).toBe('https://cdn.example.com/cover.png');
      expect(data.website).toBe('https://alice.dev');
      expect(data.location).toBe('London, UK');
      expect(data.address).toBe('Baker Street 221B');
      expect(data.gender).toBe(Gender.FEMALE);
      expect(data.dateOfBirth).toBe(dob);
      expect(data.isVerified).toBe(true);
      expect(data.isPrivate).toBe(true);
      expect(data.status).toBe(UserStatus.ACTIVE);
   });

   it('should throw BadRequestException when accountId is missing on build()', () => {
      const builder = UserProfileDataBuilder.create().withUsername('test');
      expect(() => builder.build()).toThrow(BadRequestException);
   });

   it('should parse string date of birth correctly', () => {
      const data = UserProfileDataBuilder.create()
         .withAccountId('acc-1')
         .withDateOfBirth('2000-01-01T00:00:00.000Z')
         .build();

      expect(data.dateOfBirth).toBeInstanceOf(Date);
      expect(data.dateOfBirth?.toISOString()).toBe('2000-01-01T00:00:00.000Z');
   });

   it('should set gender enum correctly', () => {
      const data = UserProfileDataBuilder.create().withAccountId('acc-1').withGender(Gender.MALE).build();

      expect(data.gender).toBe(Gender.MALE);
   });

   it('should extract payload from incoming IServiceMessage via fromServiceMessage()', () => {
      const serviceMessage = {
         pattern: 'create_profile',
         data: {
            username: 'BobMarley',
            displayName: 'Bob Marley',
            gender: Gender.MALE,
            dateOfBirth: '1945-02-06',
            location: 'Nine Mile, Jamaica',
         },
         user: {
            userId: 'acc-bob-123',
         },
      };

      const data = UserProfileDataBuilder.create().fromServiceMessage(serviceMessage).build();

      expect(data.accountId).toBe('acc-bob-123');
      expect(data.username).toBe('bobmarley');
      expect(data.displayName).toBe('Bob Marley');
      expect(data.gender).toBe(Gender.MALE);
      expect(data.location).toBe('Nine Mile, Jamaica');
   });

   it('should build UpdateUserData payload with only provided fields via buildUpdate()', () => {
      const updateData = UserProfileDataBuilder.create()
         .withDisplayName('New Name')
         .withBio('New Bio')
         .withAddress('456 Elm St')
         .asVerified(true)
         .buildUpdate();

      expect(updateData).toEqual({
         displayName: 'New Name',
         bio: 'New Bio',
         address: '456 Elm St',
         isVerified: true,
      });
      expect(updateData.username).toBeUndefined();
      expect(updateData.avatar).toBeUndefined();
   });
});
