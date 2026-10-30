import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, IsUrl, IsUUID, MaxLength, Min } from 'class-validator';

export class CreateRecipeStepDto {
   @ApiProperty({
      description: 'Sequential step number in the cooking recipe (1, 2, 3...)',
      example: 1,
   })
   @IsInt()
   @Min(1)
   stepNumber!: number;

   @ApiPropertyOptional({
      description: 'Brief title or summary of the step',
      example: 'Sơ chế thịt bò',
   })
   @IsString()
   @IsOptional()
   @MaxLength(150)
   title?: string;

   @ApiProperty({
      description: 'Detailed cooking instructions for this step',
      example: 'Rửa sạch thịt bò bằng nước gừng, thái lát mỏng vừa ăn theo thớ ngang.',
   })
   @IsString()
   @IsNotEmpty()
   instruction!: string;

   @ApiPropertyOptional({
      description: 'Timestamp in video seconds to jump directly to this step',
      example: 12,
   })
   @IsInt()
   @IsOptional()
   @Min(0)
   timestampSeconds?: number;

   @ApiPropertyOptional({
      description: 'Illustration image URL for this step',
      example: 'https://pub-50b1ab619efd4084959e011fe2e5a273.r2.dev/recipes/step_1.jpg',
   })
   @IsUrl({ require_tld: false })
   @IsOptional()
   imageUrl?: string;

   @ApiPropertyOptional({
      description: 'Media reference ID from Media service',
      example: '0192e21b-0002-7000-8000-000000000002',
   })
   @IsUUID()
   @IsOptional()
   mediaId?: string;
}
