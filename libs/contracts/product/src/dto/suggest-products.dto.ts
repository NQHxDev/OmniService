import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

export class SuggestProductsQueryDto {
   @ApiProperty({
      description: 'Prefix or partial keyword for autocomplete suggestions',
      example: 'Gạo',
      minLength: 1,
   })
   @IsNotEmpty()
   @IsString()
   query!: string;

   @ApiPropertyOptional({
      description: 'Maximum number of suggestions to return',
      default: 10,
      minimum: 1,
      maximum: 50,
   })
   @IsOptional()
   @Type(() => Number)
   @IsInt()
   @Min(1)
   @Max(50)
   limit?: number = 10;
}
