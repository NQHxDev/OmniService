import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import {
   MODERATION_ACTION,
   MODERATION_STATUS,
   type ModerationActionType,
   type ModerationStatusType,
} from '@contracts/product/constants/status.constant';

export class ModerateProductDto {
   @ApiProperty({
      description: 'Target moderation decision status',
      enum: [MODERATION_STATUS.APPROVED, MODERATION_STATUS.REJECTED, MODERATION_STATUS.SUSPENDED],
      example: MODERATION_STATUS.APPROVED,
   })
   @IsNotEmpty()
   @IsEnum([MODERATION_STATUS.APPROVED, MODERATION_STATUS.REJECTED, MODERATION_STATUS.SUSPENDED])
   moderationStatus!: ModerationStatusType;

   @ApiPropertyOptional({
      description: 'Specific moderation action taken by the administrator',
      enum: [
         MODERATION_ACTION.APPROVE,
         MODERATION_ACTION.REJECT,
         MODERATION_ACTION.SUSPEND,
         MODERATION_ACTION.APPROVE_EDIT,
         MODERATION_ACTION.REJECT_EDIT,
      ],
      example: MODERATION_ACTION.APPROVE,
   })
   @IsOptional()
   @IsEnum(MODERATION_ACTION)
   action?: ModerationActionType;

   @ApiPropertyOptional({
      description: 'Explanation reason if product was rejected or suspended',
      example: 'Product packaging image lacks nutritional certifications or batch origins.',
      maxLength: 500,
   })
   @IsOptional()
   @IsString()
   @MaxLength(500)
   rejectionReason?: string;

   @ApiPropertyOptional({
      description: 'Internal moderation notes recorded by administrator for audit purposes',
      example: 'Verified food safety lab test certificate with local agriculture authority.',
      maxLength: 1000,
   })
   @IsOptional()
   @IsString()
   @MaxLength(1000)
   moderationNotes?: string;
}
