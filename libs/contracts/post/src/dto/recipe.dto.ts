import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RecipeStepDto } from '@contracts/post/dto/recipe-step.dto';

export class RecipeDto {
   @ApiProperty({
      description: 'Unique identifier of recipe',
      example: '0192e21b-0002-7000-8000-000000000004',
   })
   recipeId!: string;

   @ApiProperty({
      description: 'Preparation time in minutes',
      example: 15,
   })
   prepTimeMinutes!: number;

   @ApiProperty({
      description: 'Cooking time in minutes',
      example: 30,
   })
   cookTimeMinutes!: number;

   @ApiProperty({
      description: 'Number of servings',
      example: 2,
   })
   servings!: number;

   @ApiProperty({
      description: 'Difficulty level (EASY, MEDIUM, HARD, EXPERT)',
      example: 'EASY',
   })
   difficulty!: string;

   @ApiPropertyOptional({
      description: 'Estimated calories per serving',
      example: 450,
      nullable: true,
   })
   calories?: number | null;

   @ApiPropertyOptional({
      description: 'Cuisine style',
      example: 'Việt Nam',
      nullable: true,
   })
   cuisine?: string | null;

   @ApiPropertyOptional({
      description: 'Chef tips and secrets to perfect the dish',
      example: 'Nên trần qua xương bò trước khi ninh.',
      nullable: true,
   })
   chefTips?: string | null;

   @ApiPropertyOptional({
      description: 'Step-by-step cooking directions',
      type: [RecipeStepDto],
   })
   steps?: RecipeStepDto[];
}
