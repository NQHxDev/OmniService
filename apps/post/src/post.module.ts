import { Module } from '@nestjs/common';
import { RedisModule, RmqModule, SERVICES } from '@common';
import { PostController } from '@post/post.controller';
import { PostGrpcController } from '@post/adapters';
import { PostService } from '@post/services';
import { POST_REPOSITORY_TOKEN, PostRepository } from '@post/repositories';
import { PostConfigModule } from '@post/config';
import { PostLoggerModule } from '@post/logger';
import { PrismaModule } from '@post/prisma';

@Module({
   imports: [
      PostConfigModule,
      PostLoggerModule,
      PrismaModule,
      RedisModule,
      RmqModule.register({
         name: SERVICES.USER_SERVICE,
      }),
   ],
   controllers: [PostController, PostGrpcController],
   providers: [
      PostService,
      {
         provide: POST_REPOSITORY_TOKEN,
         useClass: PostRepository,
      },
   ],
   exports: [PostService, POST_REPOSITORY_TOKEN],
})
export class PostModule {}
