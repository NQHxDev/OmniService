import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateAddressDto {
   @ApiProperty({
      example: '123 Nguyen Trai, Thanh Xuan, Hanoi',
      description: 'Physical living address of user (maximum 255 characters)',
      minLength: 3,
      maxLength: 255,
   })
   @IsNotEmpty({ message: 'Address must not be empty' })
   @IsString({ message: 'Address must be a string' })
   @MinLength(3, { message: 'Address must be at least 3 characters' })
   @MaxLength(255, { message: 'Address cannot exceed 255 characters' })
   address!: string;
}
