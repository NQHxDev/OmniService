import { BadRequestException } from '@common';
import { UserEntityBuilder } from '@user/builders/user-entity.builder';
import { UserStatus } from '@user/entities';

describe('UserEntityBuilder', () => {
   it('should construct a valid UserEntity with chained properties', () => {
      const createdAt = new Date('2026-01-01');
      const updatedAt = new Date('2026-01-02');
      const lastActiveAt = new Date('2026-01-03');

      const user = UserEntityBuilder.create()
         .withUserId('user-123')
         .withAccountId('account-456')
         .withUsername('johndoe')
         .withStatus(UserStatus.ACTIVE)
         .withDisplayName('John Doe')
         .withBio('Software Engineer')
         .withAvatar('https://cdn.example.com/avatar.jpg')
         .withCoverImage('https://cdn.example.com/cover.jpg')
         .withWebsite('https://example.com')
         .withLocation('San Francisco, CA')
         .withAddress('123 Main St')
         .withFollowersCount(150)
         .withFollowingCount(75)
         .withPostsCount(20)
         .withRecipesCount(5)
         .asVerified()
         .asPrivate(false)
         .withTimestamps({ createdAt, updatedAt, lastActiveAt })
         .build();

      expect(user.userId).toBe('user-123');
      expect(user.accountId).toBe('account-456');
      expect(user.username).toBe('johndoe');
      expect(user.status).toBe(UserStatus.ACTIVE);
      expect(user.displayName).toBe('John Doe');
      expect(user.bio).toBe('Software Engineer');
      expect(user.avatar).toBe('https://cdn.example.com/avatar.jpg');
      expect(user.coverImage).toBe('https://cdn.example.com/cover.jpg');
      expect(user.website).toBe('https://example.com');
      expect(user.location).toBe('San Francisco, CA');
      expect(user.address).toBe('123 Main St');
      expect(user.followersCount).toBe(150);
      expect(user.followingCount).toBe(75);
      expect(user.postsCount).toBe(20);
      expect(user.recipesCount).toBe(5);
      expect(user.isVerified).toBe(true);
      expect(user.isPrivate).toBe(false);
      expect(user.createdAt).toBe(createdAt);
      expect(user.updatedAt).toBe(updatedAt);
      expect(user.lastActiveAt).toBe(lastActiveAt);
   });

   it('should throw BadRequestException when neither userId nor accountId are provided', () => {
      const builder = UserEntityBuilder.create();
      expect(() => builder.build()).toThrow(BadRequestException);
   });

   it('should support state transition presets (asActive, asSuspended, asBlocked, asDeleted)', () => {
      const suspendedUser = UserEntityBuilder.create().withUserId('u1').asSuspended().build();
      expect(suspendedUser.status).toBe(UserStatus.SUSPENDED);

      const blockedUser = UserEntityBuilder.create().withUserId('u1').asBlocked().build();
      expect(blockedUser.status).toBe(UserStatus.BLOCKED);

      const deletedTime = new Date('2026-02-01');
      const deletedUser = UserEntityBuilder.create().withUserId('u1').asDeleted(deletedTime).build();
      expect(deletedUser.deletedAt).toBe(deletedTime);

      const activeUser = UserEntityBuilder.create().withUserId('u1').asDeleted().asActive().build();
      expect(activeUser.status).toBe(UserStatus.ACTIVE);
      expect(activeUser.deletedAt).toBeNull();
   });

   it('should correctly configure sub-entities (profile, stats, settings)', () => {
      const user = UserEntityBuilder.create()
         .withUserId('u1')
         .withProfile({
            profileId: 'p1',
            displayName: 'Jane Doe',
            bio: 'Tech enthusiast',
         })
         .withStats({
            statsId: 's1',
            followersCount: 10,
            followingCount: 5,
         })
         .withSettings({
            settingsId: 'set1',
            isVerified: true,
            isPrivate: true,
         })
         .build();

      expect(user.profile?.profileId).toBe('p1');
      expect(user.displayName).toBe('Jane Doe');
      expect(user.stats?.statsId).toBe('s1');
      expect(user.followersCount).toBe(10);
      expect(user.settings?.settingsId).toBe('set1');
      expect(user.isVerified).toBe(true);
      expect(user.isPrivate).toBe(true);
   });

   it('should hydrate from Prisma user with relations via fromPrismaUser()', () => {
      const prismaUser = {
         userId: 'user-prisma-1',
         accountId: 'account-prisma-1',
         username: 'prismadev',
         status: UserStatus.ACTIVE,
         deletedAt: null,
         createdAt: new Date('2026-01-01'),
         updatedAt: new Date('2026-01-02'),
         lastActiveAt: null,
         profile: {
            userId: 'user-prisma-1',
            profileId: 'prof-1',
            displayName: 'Prisma Dev',
            bio: 'Database lover',
            avatar: null,
            coverImage: null,
            website: null,
            location: null,
            dateOfBirth: null,
            gender: null,
            createdAt: new Date(),
            updatedAt: new Date(),
         },
         stats: {
            userId: 'user-prisma-1',
            statsId: 'stat-1',
            followersCount: 100,
            followingCount: 50,
            postsCount: 10,
            recipesCount: 2,
            createdAt: new Date(),
            updatedAt: new Date(),
         },
         settings: {
            userId: 'user-prisma-1',
            settingsId: 'setting-1',
            isVerified: false,
            isPrivate: false,
            createdAt: new Date(),
            updatedAt: new Date(),
         },
      };

      const user = UserEntityBuilder.create().fromPrismaUser(prismaUser).build();

      expect(user.userId).toBe('user-prisma-1');
      expect(user.accountId).toBe('account-prisma-1');
      expect(user.username).toBe('prismadev');
      expect(user.displayName).toBe('Prisma Dev');
      expect(user.followersCount).toBe(100);
   });
});
