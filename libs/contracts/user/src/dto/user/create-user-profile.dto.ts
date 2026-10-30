import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { GenderDto } from '@contracts/user/dto/user/update-user.dto';

export class CreateUserProfileDto {
   @ApiPropertyOptional({
      example: 'johndoe',
      description: 'Unique username (min 3, max 30 characters)',
   })
   @IsOptional()
   @IsString({ message: 'Username must be a string' })
   @MinLength(3, { message: 'Username must be at least 3 characters' })
   @MaxLength(30, { message: 'Username cannot exceed 30 characters' })
   username?: string;

   @ApiProperty({
      example: 'Johnathan Doe',
      description: 'Display name shown on profile (min 2, max 50 characters)',
   })
   @IsString({ message: 'Display name must be a string' })
   @IsNotEmpty({ message: 'Display name must not be empty' })
   @MinLength(2, { message: 'Display name must be at least 2 characters' })
   @MaxLength(50, { message: 'Display name cannot exceed 50 characters' })
   displayName!: string;

   @ApiPropertyOptional({
      example: 'MALE',
      enum: GenderDto,
      description: 'User gender',
   })
   @IsOptional()
   @IsEnum(GenderDto, { message: 'Gender must be MALE, FEMALE, OTHER, or PREFER_NOT_TO_SAY' })
   gender?: GenderDto;

   @ApiPropertyOptional({
      example: '2000-01-15',
      description: 'Date of birth (ISO 8601 format: YYYY-MM-DD)',
   })
   @IsOptional()
   @IsDateString({}, { message: 'Date of birth must be a valid ISO date string' })
   dateOfBirth?: string;

   @ApiPropertyOptional({
      example: 'Software engineer and tech enthusiast',
      description: 'Short user bio',
   })
   @IsOptional()
   @IsString()
   @MaxLength(500, { message: 'Bio cannot exceed 500 characters' })
   bio?: string;

   @ApiPropertyOptional({
      example: 'https://example.com/avatar.png',
      description: 'Avatar image URL',
   })
   @IsOptional()
   @IsString()
   avatar?: string;

   @ApiPropertyOptional({
      example: 'https://example.com/cover.png',
      description: 'Cover image URL',
   })
   @IsOptional()
   @IsString()
   coverImage?: string;

   @ApiPropertyOptional({
      example: 'https://example.com',
      description: 'Personal or website link',
   })
   @IsOptional()
   @IsString()
   website?: string;

   @ApiPropertyOptional({
      example: 'Hanoi, Vietnam',
      description: 'User location',
   })
   @IsOptional()
   @IsString()
   location?: string;

   @ApiProperty({
      example: '123 Nguyen Trai, Thanh Xuan, Hanoi',
      description: 'Physical living address of user (min 3, max 255 characters)',
   })
   @IsString({ message: 'Address must be a string' })
   @IsNotEmpty({ message: 'Address must not be empty' })
   @MinLength(3, { message: 'Address must be at least 3 characters' })
   @MaxLength(255, { message: 'Address cannot exceed 255 characters' })
   address!: string;
}
