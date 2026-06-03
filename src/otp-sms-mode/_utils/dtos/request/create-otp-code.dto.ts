import { ApiProperty } from '@nestjs/swagger';
import { IsPhoneNumber } from 'class-validator';

export class CreateOtpCodeDto {
  @ApiProperty({ example: '+33647700234' })
  @IsPhoneNumber()
  phoneNumber: string;
}
