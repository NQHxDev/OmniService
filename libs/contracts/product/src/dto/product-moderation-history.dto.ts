import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
   MODERATION_ACTION,
   MODERATION_STATUS,
   type ModerationActionType,
   type ModerationStatusType,
} from '@contracts/product/constants/status.constant';

export class ProductModerationHistoryDto {
   @ApiProperty({
      description: 'Unique moderation history audit entry identifier',
      example: '01928374-bb6d-7cb2-8e12-42981f4a9b31',
   })
   historyId!: string;

   @ApiProperty({
      description: 'Identifier of the product being audited',
      example: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
   })
   productId!: string;

   @ApiProperty({
      description: 'Account identifier of the administrator who performed the moderation',
      example: 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
   })
   moderatorId!: string;

   @ApiPropertyOptional({
      description: 'Email address of the administrator who performed the moderation',
      example: 'admin.audit@omniservices.com',
   })
   moderatorEmail?: string;

   @ApiProperty({
      description: 'Moderation action performed',
      enum: MODERATION_ACTION,
      example: MODERATION_ACTION.APPROVE,
   })
   action!: ModerationActionType;

   @ApiProperty({
      description: 'Previous moderation status of the product',
      enum: MODERATION_STATUS,
      example: MODERATION_STATUS.PENDING_APPROVAL,
   })
   previousStatus!: ModerationStatusType;

   @ApiProperty({
      description: 'New moderation status resulting from this action',
      enum: MODERATION_STATUS,
      example: MODERATION_STATUS.APPROVED,
   })
   newStatus!: ModerationStatusType;

   @ApiPropertyOptional({
      description: 'Explanation reason if moderation was rejected or suspended',
      example: 'Product packaging image lacks nutritional certifications or batch origins.',
   })
   rejectionReason?: string;

   @ApiPropertyOptional({
      description: 'Internal review notes recorded by the administrator',
      example: 'Inspected supplier certificate against National Food Standards Database.',
   })
   moderationNotes?: string;

   @ApiPropertyOptional({
      description: 'JSON snapshot of the product state at the time of moderation',
      type: Object,
      example: { productName: 'Gạo ST25', price: 180000 },
   })
   snapshot?: Record<string, unknown>;

   @ApiProperty({
      description: 'Timestamp when moderation decision was recorded',
      example: '2026-10-27T08:30:00.000Z',
   })
   createdAt!: string;
}
