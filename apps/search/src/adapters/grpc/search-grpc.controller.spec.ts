import { firstValueFrom } from 'rxjs';
import { CurrencyEnum, INGREDIENT_STATUS } from '@contracts/commerce';
import { SearchGrpcController } from './search-grpc.controller';
import type { UserSearchService, UserDocument } from '@search/domains/user-search/user-search.service';
import type {
   IngredientSearchService,
   IngredientDocument,
} from '@search/domains/ingredient-search/ingredient-search.service';
import type { PostSearchService, HydratedPostHit } from '@search/domains/post-search/post-search.service';

describe('SearchGrpcController', () => {
   let controller: SearchGrpcController;

   const mockUserSearchService = {
      searchUsers: jest.fn(),
   };

   const mockIngredientSearchService = {
      searchIngredients: jest.fn(),
   };

   const mockPostSearchService = {
      getFeed: jest.fn(),
      getPostDetail: jest.fn(),
   };

   beforeEach(() => {
      jest.clearAllMocks();

      controller = new SearchGrpcController(
         mockUserSearchService as unknown as UserSearchService,
         mockIngredientSearchService as unknown as IngredientSearchService,
         mockPostSearchService as unknown as PostSearchService,
      );
   });

   describe('searchUsers', () => {
      it('should search users and map response to proto format', async () => {
         const mockUser: UserDocument = {
            id: 'u-123',
            email: 'test@example.com',
            username: 'testuser',
            displayName: 'Test User',
            avatar: 'https://example.com/avatar.jpg',
            bio: 'Hello world',
            isVerified: true,
            followersCount: 10,
            followingCount: 5,
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
            updatedAt: new Date('2026-01-02T00:00:00.000Z'),
         };

         mockUserSearchService.searchUsers.mockResolvedValue({
            items: [mockUser],
            nextCursor: 'next-1',
            hasMore: true,
            total: 100,
         });

         const response$ = controller.searchUsers({
            query: 'test',
            limit: 10,
            cursor: 'cur-0',
         });

         const result = await firstValueFrom(response$);

         expect(mockUserSearchService.searchUsers).toHaveBeenCalledWith('test', 10, 'cur-0');
         expect(result.items).toHaveLength(1);
         expect(result.items[0].userId).toBe('u-123');
         expect(result.items[0].documentId).toBe('u-123');
         expect(result.items[0].username).toBe('testuser');
         expect(result.nextCursor).toBe('next-1');
         expect(result.hasMore).toBe(true);
         expect(result.total).toBe(100);
      });
   });

   describe('searchIngredients', () => {
      it('should search ingredients and map response to proto format', async () => {
         const mockDoc: IngredientDocument = {
            ingredientId: 'ing-1',
            ingredientName: 'Garlic',
            normalizedName: 'garlic',
            ingredientSlug: 'garlic',
            ingredientDescription: 'Fresh garlic',
            ingredientImageUrl: 'https://img.com/garlic.jpg',
            categoryId: 'cat-1',
            categoryName: 'Spices',
            defaultUnit: 'g',
            ingredientStatus: INGREDIENT_STATUS.ACTIVE,
            supplierCount: 3,
            minPrice: 10,
            maxPrice: 20,
            currency: CurrencyEnum.USD,
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
            updatedAt: new Date('2026-01-02T00:00:00.000Z'),
         };

         mockIngredientSearchService.searchIngredients.mockResolvedValue({
            items: [mockDoc],
            total: 1,
            limit: 20,
            offset: 0,
         });

         const response$ = controller.searchIngredients({
            query: 'garlic',
            categoryId: 'cat-1',
            limit: 20,
            offset: 0,
         });

         const result = await firstValueFrom(response$);

         expect(mockIngredientSearchService.searchIngredients).toHaveBeenCalledWith({
            query: 'garlic',
            categoryId: 'cat-1',
            limit: 20,
            offset: 0,
         });
         expect(result.items).toHaveLength(1);
         expect(result.items[0].ingredientId).toBe('ing-1');
         expect(result.items[0].ingredientName).toBe('Garlic');
         expect(result.total).toBe(1);
      });
   });

   describe('globalSearch', () => {
      it('should search both users and ingredients in parallel', async () => {
         mockUserSearchService.searchUsers.mockResolvedValue({
            items: [],
            nextCursor: null,
            hasMore: false,
            total: 0,
         });

         mockIngredientSearchService.searchIngredients.mockResolvedValue({
            items: [],
            total: 0,
            limit: 10,
            offset: 0,
         });

         const response$ = controller.globalSearch({
            query: 'anything',
            limit: 10,
         });

         const result = await firstValueFrom(response$);

         expect(mockUserSearchService.searchUsers).toHaveBeenCalledWith('anything', 10);
         expect(mockIngredientSearchService.searchIngredients).toHaveBeenCalledWith({
            query: 'anything',
            limit: 10,
         });
         expect(result.users).toEqual([]);
         expect(result.ingredients).toEqual([]);
         expect(result.total).toBe(0);
      });
   });

   describe('getPostFeed', () => {
      it('should retrieve feed from postSearchService and map to proto format', async () => {
         const mockPost: HydratedPostHit = {
            postId: 'post-123',
            userId: 'user-456',
            title: 'Pho Recipe',
            caption: 'Authentic Beef Pho',
            videoUrl: 'https://cdn.example.com/pho.mp4',
            thumbnailUrl: 'https://cdn.example.com/pho.jpg',
            duration: 60,
            allowComments: true,
            allowDuet: false,
            createdAt: new Date('2026-10-01T00:00:00.000Z'),
            updatedAt: new Date('2026-10-01T00:00:00.000Z'),
            author: {
               userId: 'user-456',
               displayName: 'Chef Anh',
               avatarUrl: 'https://cdn.example.com/anh.jpg',
               isVerified: true,
               followerCount: 5000,
            },
            shop: {
               shopId: 'shop-789',
               shopName: 'Pho Spice Shop',
               logoUrl: 'https://cdn.example.com/shop.jpg',
            },
            ingredients: [
               {
                  ingredientId: 'ing-1',
                  name: 'Beef Bones',
                  amount: 500,
                  unit: 'g',
                  sortOrder: 1,
               },
            ],
            tags: ['pho', 'vietnamese'],
            category: 'soup',
            likeCount: 150,
            viewCount: 2000,
            commentCount: 45,
            shareCount: 12,
            saveCount: 88,
         };

         mockPostSearchService.getFeed.mockResolvedValue({
            items: [mockPost],
            nextCursor: 'next-cursor-val',
            hasMore: true,
            total: 10,
         });

         const response$ = controller.getPostFeed({
            limit: 5,
            cursor: 'cursor-1',
         });

         const result = await firstValueFrom(response$);

         expect(mockPostSearchService.getFeed).toHaveBeenCalledWith({
            limit: 5,
            cursor: 'cursor-1',
            userId: undefined,
            tag: undefined,
            category: undefined,
         });
         expect(result.items).toHaveLength(1);
         expect(result.items[0].postId).toBe('post-123');
         expect(result.items[0].likeCount).toBe(150);
         expect(result.items[0].author.displayName).toBe('Chef Anh');
         expect(result.items[0].shop?.shopName).toBe('Pho Spice Shop');
         expect(result.nextCursor).toBe('next-cursor-val');
         expect(result.hasMore).toBe(true);
      });
   });

   describe('getPostDetail', () => {
      it('should retrieve single post detail and map to proto format', async () => {
         const mockPost: HydratedPostHit = {
            postId: 'post-999',
            userId: 'user-456',
            title: 'Spring Rolls',
            caption: 'Crispy rolls',
            videoUrl: 'https://cdn.example.com/rolls.mp4',
            thumbnailUrl: 'https://cdn.example.com/rolls.jpg',
            duration: 30,
            allowComments: true,
            allowDuet: true,
            createdAt: new Date('2026-10-02T00:00:00.000Z'),
            updatedAt: new Date('2026-10-02T00:00:00.000Z'),
            author: { userId: 'user-456' },
            ingredients: [],
            likeCount: 50,
            viewCount: 1200,
            commentCount: 5,
            shareCount: 2,
            saveCount: 10,
         };

         mockPostSearchService.getPostDetail.mockResolvedValue(mockPost);

         const response$ = controller.getPostDetail({ postId: 'post-999' });
         const result = await firstValueFrom(response$);

         expect(mockPostSearchService.getPostDetail).toHaveBeenCalledWith('post-999');
         expect(result.post.postId).toBe('post-999');
         expect(result.post.title).toBe('Spring Rolls');
         expect(result.post.viewCount).toBe(1200);
      });

      it('should throw NotFoundException if post is not found', async () => {
         mockPostSearchService.getPostDetail.mockResolvedValue(null);

         const response$ = controller.getPostDetail({ postId: 'non-existent' });
         await expect(firstValueFrom(response$)).rejects.toThrow();
      });
   });
});
