import { Difficulty, Recipe as PrismaRecipe, RecipeStep as PrismaRecipeStep } from '@post/prisma-client';
import { RecipeStepEntity } from '@post/entities/recipe-step.entity';

export class RecipeEntity implements PrismaRecipe {
   recipeId: string;
   postId: string;
   prepTimeMinutes: number;
   cookTimeMinutes: number;
   servings: number;
   difficulty: Difficulty;
   calories: number | null;
   cuisine: string | null;
   chefTips: string | null;
   createdAt: Date;
   updatedAt: Date;
   steps: RecipeStepEntity[];

   constructor(partial: Partial<PrismaRecipe> & { steps?: Partial<PrismaRecipeStep>[] }) {
      this.recipeId = partial.recipeId || '';
      this.postId = partial.postId || '';
      this.prepTimeMinutes = partial.prepTimeMinutes ?? 0;
      this.cookTimeMinutes = partial.cookTimeMinutes ?? 0;
      this.servings = partial.servings ?? 1;
      this.difficulty = partial.difficulty || Difficulty.EASY;
      this.calories = partial.calories ?? null;
      this.cuisine = partial.cuisine ?? null;
      this.chefTips = partial.chefTips ?? null;
      this.createdAt = partial.createdAt || new Date();
      this.updatedAt = partial.updatedAt || new Date();
      this.steps = (partial.steps || []).map((step) => new RecipeStepEntity(step));
   }
}
