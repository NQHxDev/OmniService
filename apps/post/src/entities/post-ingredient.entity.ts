import { PostIngredient as PrismaPostIngredient } from '@post/prisma-client';

export class PostIngredientEntity {
   ingredientId: string;
   postId: string;
   name: string;
   amount: number | null;
   unit: string | null;
   group: string | null;
   sortOrder: number;
   catalogIngredientId: string | null;

   constructor(partial: Partial<PrismaPostIngredient>) {
      this.ingredientId = partial.ingredientId || '';
      this.postId = partial.postId || '';
      this.name = partial.name || '';
      this.amount = partial.amount !== undefined && partial.amount !== null ? Number(partial.amount) : null;
      this.unit = partial.unit ?? null;
      this.group = partial.group ?? null;
      this.sortOrder = partial.sortOrder ?? 0;
      this.catalogIngredientId = partial.catalogIngredientId ?? null;
   }
}
