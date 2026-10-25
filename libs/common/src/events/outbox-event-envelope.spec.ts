import { createOutboxEventEnvelope } from '@common/events/outbox-event-envelope.interface';

describe('createOutboxEventEnvelope', () => {
   it('should generate an event envelope with generated uuidv7 and current timestamp', () => {
      const envelope = createOutboxEventEnvelope({
         aggregateType: 'user',
         aggregateId: 'usr-123',
         eventType: 'UserProfileCreatedEvent',
         payload: { username: 'testuser', email: 'test@example.com' },
      });

      expect(envelope.eventId).toBeDefined();
      expect(typeof envelope.eventId).toBe('string');
      expect(envelope.aggregateType).toBe('user');
      expect(envelope.aggregateId).toBe('usr-123');
      expect(envelope.eventType).toBe('UserProfileCreatedEvent');
      expect(envelope.payload).toEqual({ username: 'testuser', email: 'test@example.com' });
      expect(envelope.timestamp).toBeDefined();
      expect(new Date(envelope.timestamp).toISOString()).toBe(envelope.timestamp);
   });

   it('should retain custom eventId and timestamp when provided', () => {
      const customId = '018f6709-1234-7123-8123-0123456789ab';
      const customTimestamp = '2026-10-25T10:00:00.000Z';
      const envelope = createOutboxEventEnvelope({
         eventId: customId,
         timestamp: customTimestamp,
         aggregateType: 'auth',
         aggregateId: 'acc-999',
         eventType: 'AccountRegisteredEvent',
         payload: { accountId: 'acc-999' },
         metadata: { correlationId: 'req-abc' },
      });

      expect(envelope.eventId).toBe(customId);
      expect(envelope.timestamp).toBe(customTimestamp);
      expect(envelope.metadata).toEqual({ correlationId: 'req-abc' });
   });
});
