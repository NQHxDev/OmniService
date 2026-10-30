import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min, ValidateNested } from 'class-validator';
import { RECIPE_DIFFICULTY, type RecipeDifficulty } from '@contracts/post/constants';
import { CreateRecipeStepDto } from '@contracts/post/dto/create-recipe-step.dto';

export class CreateRecipeDto {
   @ApiPropertyOptional({
      description: 'Preparation time in minutes',
      example: 15,
      default: 0,
   })
   @IsInt()
   @IsOptional()
   @Min(0)
   prepTimeMinutes?: number = 0;

   @ApiPropertyOptional({
      description: 'Cooking time in minutes',
      example: 30,
      default: 0,
   })
   @IsInt()
   @IsOptional()
   @Min(0)
   cookTimeMinutes?: number = 0;

   @ApiPropertyOptional({
      description: 'Number of servings',
      example: 2,
      default: 1,
   })
   @IsInt()
   @IsOptional()
   @Min(1)
   servings?: number = 1;

   @ApiPropertyOptional({
      description: 'Difficulty level of the recipe',
      enum: RECIPE_DIFFICULTY,
      example: 'EASY',
      default: 'EASY',
   })
   @IsEnum(RECIPE_DIFFICULTY)
   @IsOptional()
   difficulty?: RecipeDifficulty = 'EASY';

   @ApiPropertyOptional({
      description: 'Estimated calories per serving (kcal)',
      example: 450,
   })
   @IsInt()
   @IsOptional()
   @Min(0)
   calories?: number;

   @ApiPropertyOptional({
      description: 'Cuisine style (Việt Nam, Ý, Hàn Quốc, etc.)',
      example: 'Việt Nam',
   })
   @IsString()
   @IsOptional()
   @MaxLength(50)
   cuisine?: string;

   @ApiPropertyOptional({
      description: 'Chef tips and secrets to perfect the dish',
      example: 'Nên trần qua xương bò trước khi ninh để nước dùng trong vắt.',
   })
   @IsString()
   @IsOptional()
   chefTips?: string;

   @ApiPropertyOptional({
      description: 'Step-by-step cooking directions',
      type: [CreateRecipeStepDto],
   })
   @IsArray()
   @ValidateNested({ each: true })
   @Type(() => CreateRecipeStepDto)
   @IsOptional()
   steps?: CreateRecipeStepDto[];
}
