import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RecipeStepDto {
   @ApiProperty({
      description: 'Unique identifier of recipe step',
      example: '0192e21b-0002-7000-8000-000000000003',
   })
   stepId!: string;

   @ApiProperty({
      description: 'Sequential step number',
      example: 1,
   })
   stepNumber!: number;

   @ApiPropertyOptional({
      description: 'Step title or short summary',
      example: 'Sơ chế thịt bò',
      nullable: true,
   })
   title?: string | null;

   @ApiProperty({
      description: 'Step instructions',
      example: 'Rửa sạch thịt bò bằng nước gừng, thái lát mỏng vừa ăn.',
   })
   instruction!: string;

   @ApiPropertyOptional({
      description: 'Timestamp in video seconds to navigate to this step',
      example: 15,
      nullable: true,
   })
   timestampSeconds?: number | null;

   @ApiPropertyOptional({
      description: 'Step illustration image URL',
      example: 'https://pub-50b1ab619efd4084959e011fe2e5a273.r2.dev/recipes/step_1.jpg',
      nullable: true,
   })
   imageUrl?: string | null;

   @ApiPropertyOptional({
      description: 'Step media asset ID',
      example: '0192e21b-0002-7000-8000-000000000002',
      nullable: true,
   })
   mediaId?: string | null;
}
