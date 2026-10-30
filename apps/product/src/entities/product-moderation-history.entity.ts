export class ProductModerationHistoryEntity {
   historyId!: string;
   productId!: string;
   moderatorId!: string;
   moderatorEmail?: string | null;
   action!: string;
   previousStatus!: string;
   newStatus!: string;
   rejectionReason?: string | null;
   moderationNotes?: string | null;
   snapshot?: Record<string, unknown> | null;
   createdAt!: Date;
}
