import { Reflector } from '@nestjs/core';
import {
   IDEMPOTENT_MESSAGE_METADATA,
   IdempotentMessage,
   type IdempotentMessageOptions,
} from '@common/decorators/idempotent-message.decorator';

describe('IdempotentMessage Decorator', () => {
   const reflector = new Reflector();

   class TestHandler {
      @IdempotentMessage({ ttlSeconds: 3600, prefix: 'custom-prefix' })
      handleEvent() {
         return 'ok';
      }

      @IdempotentMessage()
      handleDefault() {
         return 'ok';
      }
   }

   it('should attach options metadata to the method', () => {
      const handler = new TestHandler();
      const metadata = reflector.get<IdempotentMessageOptions>(IDEMPOTENT_MESSAGE_METADATA, handler.handleEvent);

      expect(metadata).toEqual({
         ttlSeconds: 3600,
         prefix: 'custom-prefix',
      });
   });

   it('should attach empty options object if no argument provided', () => {
      const handler = new TestHandler();
      const metadata = reflector.get<IdempotentMessageOptions>(IDEMPOTENT_MESSAGE_METADATA, handler.handleDefault);

      expect(metadata).toEqual({});
   });
});
