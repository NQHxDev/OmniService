import { Injectable } from '@nestjs/common';
import { Difficulty, Prisma, PostStatus, Visibility } from '@post/prisma-client';
import { PrismaService } from '@post/prisma';
import { PostEntity, PostIngredientEntity } from '@post/entities';
import type { CreatePostDto } from '@contracts/post';
import { IFeedQueryResult, IFindFeedParams, IPostRepository } from '@post/repositories/post.repository.interface';

const POST_RELATIONS_INCLUDE = {
   ingredients: {
      orderBy: { sortOrder: 'asc' as const },
   },
   recipe: {
      include: {
         steps: {
            orderBy: { stepNumber: 'asc' as const },
         },
      },
   },
   tags: {
      include: {
         tag: true,
      },
   },
   mentions: true,
} satisfies Prisma.PostInclude;

@Injectable()
export class PostRepository implements IPostRepository {
   constructor(private readonly prisma: PrismaService) {}

   async findFeed(params: IFindFeedParams): Promise<IFeedQueryResult> {
      const { cursor, limit, userId, tag, category } = params;

      const where: Prisma.PostWhereInput = {
         status: PostStatus.PUBLISHED,
         visibility: Visibility.PUBLIC,
      };

      if (userId) {
         where.userId = userId;
      }

      if (category) {
         where.categories = {
            some: {
               OR: [{ categoryId: category }, { category: { slug: category } }],
            },
         };
      }

      if (tag) {
         where.tags = {
            some: {
               tag: {
                  OR: [{ slug: tag }, { name: tag }],
               },
            },
         };
      }

      if (cursor) {
         where.AND = [
            {
               OR: [
                  {
                     createdAt: {
                        lt: cursor.createdAt,
                     },
                  },
                  {
                     createdAt: cursor.createdAt,
                     postId: {
                        lt: cursor.postId,
                     },
                  },
               ],
            },
         ];
      }

      // Fetch limit + 1 to determine if next page exists, include ingredients ordered by sortOrder
      const records = await this.prisma.post.findMany({
         where,
         take: limit + 1,
         orderBy: [{ createdAt: 'desc' }, { postId: 'desc' }],
         include: POST_RELATIONS_INCLUDE,
      });

      const hasMore = records.length > limit;
      const slicedRecords = hasMore ? records.slice(0, limit) : records;
      const items = slicedRecords.map((item) => new PostEntity(item));

      let nextCursor: { createdAt: Date; postId: string } | null = null;
      if (hasMore && items.length > 0) {
         const lastItem = items[items.length - 1];
         nextCursor = {
            createdAt: lastItem.createdAt,
            postId: lastItem.postId,
         };
      }

      return {
         items,
         nextCursor,
         hasMore,
      };
   }

   async findById(postId: string): Promise<PostEntity | null> {
      const post = await this.prisma.post.findUnique({
         where: { postId },
         include: POST_RELATIONS_INCLUDE,
      });

      if (!post) {
         return null;
      }

      return new PostEntity(post);
   }

   async findIngredientsByPostId(postId: string): Promise<PostIngredientEntity[]> {
      const records = await this.prisma.postIngredient.findMany({
         where: { postId },
         orderBy: { sortOrder: 'asc' },
      });

      return records.map((record) => new PostIngredientEntity(record));
   }

   async create(userId: string, data: CreatePostDto): Promise<PostEntity> {
      // 1. Extract hashtags from caption and combine with provided tags
      const hashtagMatches = (data.caption || '').matchAll(/#([a-zA-Z0-9_\u00C0-\u1EF9]+)/g);
      const extractedTags: string[] = [];
      for (const match of hashtagMatches) {
         if (match[1]) {
            extractedTags.push(match[1].toLowerCase());
         }
      }

      const combinedTags = Array.from(
         new Set([...(data.tags || []).map((t) => t.replace(/^#/, '').toLowerCase().trim()), ...extractedTags]),
      ).filter((t) => t.length > 0);

      // 2. Open Prisma transaction for atomic multi-entity write
      const createdPost = await this.prisma.$transaction(async (tx) => {
         // Upsert tags & increment usageCount
         const tagRecords = await Promise.all(
            combinedTags.map(async (tagName) => {
               const slug = tagName.toLowerCase().replace(/[^a-z0-9\u00C0-\u1EF9]/g, '-');
               return tx.tag.upsert({
                  where: { name: tagName },
                  create: { name: tagName, slug: slug || tagName, usageCount: 1 },
                  update: { usageCount: { increment: 1 } },
               });
            }),
         );

         return tx.post.create({
            data: {
               userId,
               title: data.title,
               caption: data.caption,
               status: PostStatus.PUBLISHED,
               visibility: (data.visibility as Visibility) || Visibility.PUBLIC,
               mediaId: data.mediaId,
               videoUrl: data.videoUrl,
               playbackUrl: data.playbackUrl,
               thumbnailUrl: data.thumbnailUrl,
               blurHash: data.blurHash,
               duration: data.duration,
               videoWidth: data.videoWidth,
               videoHeight: data.videoHeight,
               allowComments: data.allowComments ?? true,
               allowDuet: data.allowDuet ?? false,
               ingredients:
                  data.ingredients && data.ingredients.length > 0
                     ? {
                          create: data.ingredients.map((ing, idx) => ({
                             name: ing.name,
                             amount: ing.amount !== undefined ? ing.amount : null,
                             unit: ing.unit,
                             group: ing.group,
                             sortOrder: ing.sortOrder ?? idx,
                             catalogIngredientId: ing.catalogIngredientId,
                          })),
                       }
                     : undefined,
               recipe: data.recipe
                  ? {
                       create: {
                          prepTimeMinutes: data.recipe.prepTimeMinutes ?? 0,
                          cookTimeMinutes: data.recipe.cookTimeMinutes ?? 0,
                          servings: data.recipe.servings ?? 1,
                          difficulty: (data.recipe.difficulty as Difficulty) || Difficulty.EASY,
                          calories: data.recipe.calories,
                          cuisine: data.recipe.cuisine,
                          chefTips: data.recipe.chefTips,
                          steps:
                             data.recipe.steps && data.recipe.steps.length > 0
                                ? {
                                     create: data.recipe.steps.map((st, idx) => ({
                                        stepNumber: st.stepNumber ?? idx + 1,
                                        title: st.title,
                                        instruction: st.instruction,
                                        timestampSeconds: st.timestampSeconds,
                                        imageUrl: st.imageUrl,
                                        mediaId: st.mediaId,
                                     })),
                                  }
                                : undefined,
                       },
                    }
                  : undefined,
               tags:
                  tagRecords.length > 0
                     ? {
                          create: tagRecords.map((tag) => ({
                             tagId: tag.tagId,
                          })),
                       }
                     : undefined,
               mentions:
                  data.mentionedUserIds && data.mentionedUserIds.length > 0
                     ? {
                          create: Array.from(new Set(data.mentionedUserIds)).map((mUserId) => ({
                             userId: mUserId,
                          })),
                       }
                     : undefined,
               categories:
                  data.categoryIds && data.categoryIds.length > 0
                     ? {
                          create: Array.from(new Set(data.categoryIds)).map((catId) => ({
                             categoryId: catId,
                          })),
                       }
                     : undefined,
            },
            include: POST_RELATIONS_INCLUDE,
         });
      });

      return new PostEntity(createdPost);
   }
}
