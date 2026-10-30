import {
   Post as PrismaPost,
   PostIngredient as PrismaPostIngredient,
   PostStatus,
   Visibility,
   Recipe as PrismaRecipe,
   RecipeStep as PrismaRecipeStep,
   PostTag,
   Tag,
   PostMention,
} from '@post/prisma-client';
import { PostIngredientEntity } from '@post/entities/post-ingredient.entity';
import { RecipeEntity } from '@post/entities/recipe.entity';

export class PostEntity implements PrismaPost {
   postId: string;
   userId: string;
   title: string;
   caption: string | null;
   status: PostStatus;
   visibility: Visibility;
   mediaId: string | null;
   videoUrl: string;
   playbackUrl: string | null;
   thumbnailUrl: string;
   blurHash: string | null;
   duration: number;
   videoWidth: number | null;
   videoHeight: number | null;
   viewCount: number;
   likeCount: number;
   commentCount: number;
   shareCount: number;
   saveCount: number;
   allowComments: boolean;
   allowDuet: boolean;
   createdAt: Date;
   updatedAt: Date;
   publishedAt: Date | null;
   ingredients: PostIngredientEntity[];
   recipe: RecipeEntity | null;
   tags: string[];
   mentionedUserIds: string[];

   constructor(
      partial: Partial<PrismaPost> & {
         ingredients?: Partial<PrismaPostIngredient>[];
         recipe?: (Partial<PrismaRecipe> & { steps?: Partial<PrismaRecipeStep>[] }) | null;
         tags?: ({ tag?: Partial<Tag> } | Partial<PostTag>)[];
         mentions?: Partial<PostMention>[];
         tagNames?: string[];
         mentionedUserIds?: string[];
      },
   ) {
      this.postId = partial.postId || '';
      this.userId = partial.userId || '';
      this.title = partial.title || '';
      this.caption = partial.caption ?? null;
      this.status = partial.status || PostStatus.PUBLISHED;
      this.visibility = partial.visibility || Visibility.PUBLIC;
      this.mediaId = partial.mediaId ?? null;
      this.videoUrl = partial.videoUrl || '';
      this.playbackUrl = partial.playbackUrl ?? null;
      this.thumbnailUrl = partial.thumbnailUrl || '';
      this.blurHash = partial.blurHash ?? null;
      this.duration = partial.duration ?? 0;
      this.videoWidth = partial.videoWidth ?? null;
      this.videoHeight = partial.videoHeight ?? null;
      this.viewCount = partial.viewCount ?? 0;
      this.likeCount = partial.likeCount ?? 0;
      this.commentCount = partial.commentCount ?? 0;
      this.shareCount = partial.shareCount ?? 0;
      this.saveCount = partial.saveCount ?? 0;
      this.allowComments = partial.allowComments ?? true;
      this.allowDuet = partial.allowDuet ?? false;
      this.createdAt = partial.createdAt || new Date();
      this.updatedAt = partial.updatedAt || new Date();
      this.publishedAt = partial.publishedAt ?? null;
      this.ingredients = (partial.ingredients || []).map((item) => new PostIngredientEntity(item));
      this.recipe = partial.recipe ? new RecipeEntity(partial.recipe) : null;
      this.tags =
         partial.tagNames ||
         (partial.tags || [])
            .map((t) => {
               if ('tag' in t && t.tag && t.tag.name) return t.tag.name;
               if ('name' in t && typeof (t as unknown as Tag).name === 'string') return (t as unknown as Tag).name;
               return '';
            })
            .filter((name): name is string => Boolean(name));
      this.mentionedUserIds =
         partial.mentionedUserIds || (partial.mentions || []).map((m) => m.userId || '').filter(Boolean);
   }
}
