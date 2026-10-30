import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PostAuthorDto {
   @ApiProperty({
      description: 'Identifier of the user who authored the post',
      example: '0192e21b-0002-7000-8000-000000000010',
   })
   userId!: string;

   @ApiPropertyOptional({
      description: 'Public display name of the post author',
      example: 'Chef Anh',
      nullable: true,
   })
   displayName?: string | null;

   @ApiPropertyOptional({
      description: 'Avatar image URL of the post author',
      example: 'https://cdn.example.com/avatars/chef-anh.jpg',
      nullable: true,
   })
   avatarUrl?: string | null;
}
