export interface IPostIngredientProto {
   ingredientId: string;
   name: string;
   amount?: number;
   unit?: string;
   group?: string;
   sortOrder: number;
   catalogIngredientId?: string;
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
}
