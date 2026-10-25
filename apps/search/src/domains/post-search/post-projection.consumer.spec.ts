import type { RmqContext } from '@nestjs/microservices';
import { PostProjectionConsumer } from '@search/domains/post-search/post-projection.consumer';
import type { PostSearchService } from '@search/domains/post-search/post-search.service';
import type { AppLogger, RedisService, RmqService } from '@common';

describe('PostProjectionConsumer', () => {
   let consumer: PostProjectionConsumer;

   const mockPostSearchService = {
      indexPost: jest.fn(),
      updatePost: jest.fn(),
      deletePost: jest.fn(),
      updateAuthorProfile: jest.fn(),
      updateShopInfo: jest.fn(),
   };

   const mockRedisClient = {
      set: jest.fn(),
   };

   const mockRedisService = {
      getClient: jest.fn().mockReturnValue(mockRedisClient),
      del: jest.fn(),
   };

   const mockRmqService = {
      ack: jest.fn(),
      handleError: jest.fn(),
   };

   const mockLogger = {
      setContext: jest.fn(),
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
   };

   const mockContext = {} as RmqContext;

   beforeEach(() => {
      jest.clearAllMocks();
      consumer = new PostProjectionConsumer(
         mockPostSearchService as unknown as PostSearchService,
         mockRedisService as unknown as RedisService,
         mockRmqService as unknown as RmqService,
         mockLogger as unknown as AppLogger,
      );
   });

   describe('handlePostCreatedOrPublished', () => {
      it('should index post and ack message when not duplicate', async () => {
         mockRedisClient.set.mockResolvedValue('OK');
         mockPostSearchService.indexPost.mockResolvedValue(undefined);

         await consumer.handlePostCreatedOrPublished(
            {
               eventId: 'evt-1',
               postId: 'post-1',
               userId: 'user-1',
               title: 'Test Post',
               videoUrl: 'https://cdn.com/v.mp4',
               thumbnailUrl: 'https://cdn.com/t.jpg',
            },
            mockContext,
         );

         expect(mockRedisClient.set).toHaveBeenCalledWith('idempotency:search:event:evt-1', '1', 'EX', 86400, 'NX');
         expect(mockPostSearchService.indexPost).toHaveBeenCalledWith(
            expect.objectContaining({
               postId: 'post-1',
               userId: 'user-1',
               title: 'Test Post',
            }),
         );
         expect(mockRmqService.ack).toHaveBeenCalledWith(mockContext);
      });

      it('should skip processing and immediately ack when duplicate event is received', async () => {
         mockRedisClient.set.mockResolvedValue(null); // Key already exists

         await consumer.handlePostCreatedOrPublished(
            {
               eventId: 'evt-dup',
               postId: 'post-1',
               userId: 'user-1',
               title: 'Test Post',
               videoUrl: 'https://cdn.com/v.mp4',
               thumbnailUrl: 'https://cdn.com/t.jpg',
            },
            mockContext,
         );

         expect(mockPostSearchService.indexPost).not.toHaveBeenCalled();
         expect(mockRmqService.ack).toHaveBeenCalledWith(mockContext);
      });
   });

   describe('handlePostDeleted', () => {
      it('should delete post projection and ack message', async () => {
         mockRedisClient.set.mockResolvedValue('OK');
         mockPostSearchService.deletePost.mockResolvedValue(undefined);

         await consumer.handlePostDeleted({ eventId: 'evt-del', postId: 'post-1' }, mockContext);

         expect(mockPostSearchService.deletePost).toHaveBeenCalledWith('post-1');
         expect(mockRmqService.ack).toHaveBeenCalledWith(mockContext);
      });
   });

   describe('handleUserProfileUpdated', () => {
      it('should propagate user profile changes to denormalized posts', async () => {
         mockRedisClient.set.mockResolvedValue('OK');
         mockPostSearchService.updateAuthorProfile.mockResolvedValue(undefined);

         await consumer.handleUserProfileUpdated(
            {
               eventId: 'evt-u',
               userId: 'user-1',
               displayName: 'New Nickname',
               avatarUrl: 'https://cdn.com/a.jpg',
            },
            mockContext,
         );

         expect(mockPostSearchService.updateAuthorProfile).toHaveBeenCalledWith(
            'user-1',
            expect.objectContaining({
               displayName: 'New Nickname',
               avatarUrl: 'https://cdn.com/a.jpg',
            }),
         );
         expect(mockRmqService.ack).toHaveBeenCalledWith(mockContext);
      });
   });

   describe('handleSupplierInfoUpdated', () => {
      it('should propagate shop info changes to denormalized posts', async () => {
         mockRedisClient.set.mockResolvedValue('OK');
         mockPostSearchService.updateShopInfo.mockResolvedValue(undefined);

         await consumer.handleSupplierInfoUpdated(
            {
               eventId: 'evt-s',
               shopId: 'shop-1',
               shopName: 'New Shop Name',
            },
            mockContext,
         );

         expect(mockPostSearchService.updateShopInfo).toHaveBeenCalledWith(
            'shop-1',
            expect.objectContaining({
               shopName: 'New Shop Name',
            }),
         );
         expect(mockRmqService.ack).toHaveBeenCalledWith(mockContext);
      });
   });
});
