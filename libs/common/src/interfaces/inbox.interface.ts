export const INBOX_REPOSITORY = Symbol('INBOX_REPOSITORY');

/**
 * Interface for Inbox Pattern storage to guarantee exactly-once/idempotent processing
 * in high-consistency transactional domains.
 */
export interface IInboxRepository {
   /**
    * Checks if a message ID has already been processed or registered.
    */
   exists(messageId: string, tx?: unknown): Promise<boolean>;

   /**
    * Records a successfully processed message.
    */
   recordProcessed(messageId: string, handler: string, tx?: unknown): Promise<void>;
}
