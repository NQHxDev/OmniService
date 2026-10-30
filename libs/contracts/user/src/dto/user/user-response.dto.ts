import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserProfileDto {
   @ApiProperty({
      description: 'Profile UUID identifier',
      example: '018dc3bc-11a2-7f28-9842-bc08684d0002',
   })
   id!: string;

   @ApiProperty({
      description: 'User UUID identifier this profile belongs to',
      example: '018dc3bc-11a2-7f28-9842-bc08684d0001',
   })
   userId!: string;

   @ApiPropertyOptional({
      description: 'User display name',
      example: 'Johnathan Doe',
      nullable: true,
   })
   displayName?: string | null;

   @ApiPropertyOptional({
      description: 'Short user bio',
      example: 'Software engineer and tech enthusiast',
      nullable: true,
   })
   bio?: string | null;

   @ApiPropertyOptional({
      description: 'Public URL to user avatar image',
      example: 'https://res.cloudinary.com/demo/image/upload/v1/avatar.jpg',
      nullable: true,
   })
   avatar?: string | null;

   @ApiPropertyOptional({
      description: 'Public URL to profile cover image',
      example: 'https://res.cloudinary.com/demo/image/upload/v1/cover.jpg',
      nullable: true,
   })
   coverImage?: string | null;

   @ApiPropertyOptional({
      description: 'Personal or business website URL',
      example: 'https://example.com',
      nullable: true,
   })
   website?: string | null;

   @ApiPropertyOptional({
      description: 'User geographical location',
      example: 'San Francisco, CA',
      nullable: true,
   })
   location?: string | null;

   @ApiPropertyOptional({
      description: 'User physical address',
      example: '123 Nguyen Trai, Thanh Xuan, Hanoi',
      nullable: true,
   })
   address?: string | null;

   @ApiProperty({
      description: 'Timestamp when profile was created',
      example: '2026-01-01T00:00:00.000Z',
   })
   createdAt!: Date | string;

   @ApiProperty({
      description: 'Timestamp when profile was last updated',
      example: '2026-01-02T00:00:00.000Z',
   })
   updatedAt!: Date | string;
}

export class UserStatsDto {
   @ApiProperty({
      description: 'Stats UUID identifier',
      example: '018dc3bc-11a2-7f28-9842-bc08684d0003',
   })
   id!: string;

   @ApiProperty({
      description: 'User UUID identifier this stats record belongs to',
      example: '018dc3bc-11a2-7f28-9842-bc08684d0001',
   })
   userId!: string;

   @ApiProperty({
      description: 'Total number of followers',
      example: 120,
   })
   followersCount!: number;

   @ApiProperty({
      description: 'Total number of following users',
      example: 85,
   })
   followingCount!: number;

   @ApiProperty({
      description: 'Total number of posts created',
      example: 42,
   })
   postsCount!: number;

   @ApiProperty({
      description: 'Total number of recipes shared',
      example: 15,
   })
   recipesCount!: number;

   @ApiProperty({
      description: 'Timestamp when stats record was created',
      example: '2026-01-01T00:00:00.000Z',
   })
   createdAt!: Date | string;

   @ApiProperty({
      description: 'Timestamp when stats record was last updated',
      example: '2026-01-02T00:00:00.000Z',
   })
   updatedAt!: Date | string;
}

export class UserSettingsDto {
   @ApiProperty({
      description: 'Settings UUID identifier',
      example: '018dc3bc-11a2-7f28-9842-bc08684d0004',
   })
   id!: string;

   @ApiProperty({
      description: 'User UUID identifier this settings record belongs to',
      example: '018dc3bc-11a2-7f28-9842-bc08684d0001',
   })
   userId!: string;

   @ApiProperty({
      description: 'Whether user profile has verified badge',
      example: false,
   })
   isVerified!: boolean;

   @ApiProperty({
      description: 'Whether user account is private (requires follow approval)',
      example: false,
   })
   isPrivate!: boolean;

   @ApiProperty({
      description: 'Timestamp when settings record was created',
      example: '2026-01-01T00:00:00.000Z',
   })
   createdAt!: Date | string;

   @ApiProperty({
      description: 'Timestamp when settings record was last updated',
      example: '2026-01-02T00:00:00.000Z',
   })
   updatedAt!: Date | string;
}

export class UserResponseDto {
   @ApiProperty({
      description: 'User unique UUID identifier',
      example: '018dc3bc-11a2-7f28-9842-bc08684d0001',
   })
   id!: string;

   @ApiProperty({
      description: 'Account UUID identifier linked in Auth Service',
      example: '018dc3bc-11a2-7f28-9842-bc08684d0001',
   })
   accountId!: string;

   @ApiPropertyOptional({
      description: 'Unique username identifier',
      example: 'john_doe',
      nullable: true,
   })
   username?: string | null;

   @ApiProperty({
      description: 'Account status',
      example: 'ACTIVE',
      enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'DELETED'],
   })
   status!: string;

   @ApiProperty({
      description: 'Timestamp when user profile was created',
      example: '2026-01-01T00:00:00.000Z',
   })
   createdAt!: Date | string;

   @ApiProperty({
      description: 'Timestamp when user profile was last updated',
      example: '2026-01-02T00:00:00.000Z',
   })
   updatedAt!: Date | string;

   @ApiPropertyOptional({
      description: 'Timestamp of last activity on the platform',
      example: '2026-10-11T09:41:51.000Z',
      nullable: true,
   })
   lastActiveAt?: Date | string | null;

   @ApiPropertyOptional({
      description: 'Timestamp when username was last changed (used for 30-day cooldown enforcement)',
      example: '2026-09-18T00:00:00.000Z',
      nullable: true,
   })
   lastUsernameChangedAt?: Date | string | null;

   @ApiPropertyOptional({
      description: 'User profile details (bio, avatar, display name, etc.)',
      type: () => UserProfileDto,
      nullable: true,
   })
   profile?: UserProfileDto | null;

   @ApiPropertyOptional({
      description: 'Social graph statistics (followers, following, posts)',
      type: () => UserStatsDto,
      nullable: true,
   })
   stats?: UserStatsDto | null;

   @ApiPropertyOptional({
      description: 'Account privacy and verification settings',
      type: () => UserSettingsDto,
      nullable: true,
   })
   settings?: UserSettingsDto | null;

   @ApiPropertyOptional({
      description: 'Flattened display name',
      example: 'Johnathan Doe',
      nullable: true,
   })
   displayName?: string | null;

   @ApiPropertyOptional({
      description: 'Flattened avatar URL',
      example: 'https://res.cloudinary.com/demo/image/upload/v1/avatar.jpg',
      nullable: true,
   })
   avatar?: string | null;

   @ApiPropertyOptional({
      description: 'Flattened bio',
      example: 'Software engineer and tech enthusiast',
      nullable: true,
   })
   bio?: string | null;

   @ApiPropertyOptional({
      description: 'Flattened physical address',
      example: '123 Nguyen Trai, Thanh Xuan, Hanoi',
      nullable: true,
   })
   address?: string | null;
}
