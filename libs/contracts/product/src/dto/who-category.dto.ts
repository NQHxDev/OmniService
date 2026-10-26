import { ApiProperty } from '@nestjs/swagger';
import type { WhoCategoryCode } from '../constants/product-categories.constant';

export class WhoCategoryDto {
   @ApiProperty({
      description: 'Standard WHO nutrition group code',
      example: 'STAPLES',
   })
   code!: WhoCategoryCode;

   @ApiProperty({
      description: 'Vietnamese category name according to WHO classification',
      example: 'Lương thực chính (Tinh bột)',
   })
   name!: string;

   @ApiProperty({
      description: 'Nutritional category description',
      example: 'Gạo, ngô, lúa mì, khoai lang, khoai tây, sắn và các loại củ giàu tinh bột khác.',
   })
   description!: string;

   @ApiProperty({
      description: 'Representative examples of items within this category',
      example: 'Gạo tẻ, gạo lứt, ngô ngọt, khoai lang mật, bột mì',
   })
   examples!: string;

   @ApiProperty({
      description: 'Display order priority',
      example: 1,
   })
   order!: number;
}
