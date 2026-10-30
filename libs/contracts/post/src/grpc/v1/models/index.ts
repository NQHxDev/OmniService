export interface IPostIngredientProto {
   ingredientId: string;
   name: string;
   amount?: number;
   unit?: string;
   group?: string;
   sortOrder: number;
   catalogIngredientId?: string;
}

export interface IRecipeStepProto {
   stepId: string;
   stepNumber: number;
   title?: string;
   instruction: string;
   timestampSeconds?: number;
   imageUrl?: string;
   mediaId?: string;
}

export interface IRecipeProto {
   recipeId: string;
   prepTimeMinutes: number;
   cookTimeMinutes: number;
   servings: number;
   difficulty: string;
   calories?: number;
   cuisine?: string;
   chefTips?: string;
   steps?: IRecipeStepProto[];
}

export interface IPostItemProto {
   postId: string;
   userId: string;
   title: string;
   caption?: string;
   mediaId?: string;
   videoUrl: string;
   playbackUrl?: string;
   thumbnailUrl: string;
   blurHash?: string;
   duration: number;
   videoWidth?: number;
   videoHeight?: number;
   viewCount: number;
   likeCount: number;
   commentCount: number;
   shareCount: number;
   saveCount: number;
   allowComments: boolean;
   allowDuet: boolean;
   createdAt: string;
   updatedAt: string;
   ingredients?: IPostIngredientProto[];
   recipe?: IRecipeProto;
   tags?: string[];
   mentionedUserIds?: string[];
}
