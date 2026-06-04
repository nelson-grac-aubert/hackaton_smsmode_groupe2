import { ApiProperty } from '@nestjs/swagger';
import { IsPhoneNumber, IsString, Length } from 'class-validator';

export class VerifyOtpCodeDto {
  @ApiProperty({ example: '+33647700234' })
  @IsPhoneNumber()
  phoneNumber: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6)
  token: string;
}
