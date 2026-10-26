import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { MODERATION_STATUS, type ModerationStatusType } from '../constants/status.constant';

export class ModerateProductDto {
   @ApiProperty({
      description: 'Target moderation decision status',
      enum: [MODERATION_STATUS.APPROVED, MODERATION_STATUS.REJECTED],
      example: MODERATION_STATUS.APPROVED,
   })
   @IsNotEmpty()
   @IsEnum([MODERATION_STATUS.APPROVED, MODERATION_STATUS.REJECTED])
   moderationStatus!: ModerationStatusType;

   @ApiPropertyOptional({
      description: 'Explanation reason if product was rejected',
      example: 'Hình ảnh nhãn mác chưa rõ nguồn gốc xuất xứ, vui lòng bổ sung.',
      maxLength: 500,
   })
   @IsOptional()
   @IsString()
   @MaxLength(500)
   rejectionReason?: string;
}
