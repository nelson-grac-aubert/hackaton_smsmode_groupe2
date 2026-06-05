import { ApiProperty } from '@nestjs/swagger';
import { IsPhoneNumber, IsString, IsNotEmpty } from 'class-validator';

export class CreateOtpCodeDto {
  @ApiProperty({ example: '+33682768181' })
  @IsPhoneNumber()
  phoneNumber: string;

  @ApiProperty({ example: 'appId' })
  @IsString()
  @IsNotEmpty()
  appId: string;
}