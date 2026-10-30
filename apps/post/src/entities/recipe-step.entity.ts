import { RecipeStep as PrismaRecipeStep } from '@post/prisma-client';

export class RecipeStepEntity implements PrismaRecipeStep {
   stepId: string;
   recipeId: string;
   stepNumber: number;
   title: string | null;
   instruction: string;
   timestampSeconds: number | null;
   imageUrl: string | null;
   mediaId: string | null;

   constructor(partial: Partial<PrismaRecipeStep>) {
      this.stepId = partial.stepId || '';
      this.recipeId = partial.recipeId || '';
      this.stepNumber = partial.stepNumber ?? 1;
      this.title = partial.title ?? null;
      this.instruction = partial.instruction || '';
      this.timestampSeconds = partial.timestampSeconds ?? null;
      this.imageUrl = partial.imageUrl ?? null;
      this.mediaId = partial.mediaId ?? null;
   }
}
