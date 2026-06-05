import { ApiProperty } from '@nestjs/swagger';
import { IsPhoneNumber, IsString } from 'class-validator';

export class CreateOtpCodeDto {
  @ApiProperty({ example: '+33682768181' })
  @IsPhoneNumber()
  phoneNumber: string;

  @ApiProperty({ example: 'sess_abc123' })
  @IsString()
  sessionId: string;
}
