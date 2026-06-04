import { ApiProperty } from '@nestjs/swagger';
import { IsPhoneNumber, IsString } from 'class-validator';

export class CreateOtpCodeDto {
  @ApiProperty({ example: '+33647700234' })
  @IsPhoneNumber()
  phoneNumber: string;

  @ApiProperty({ example: 'cm_xyz123' })
  @IsString()
  appId: string;

  @ApiProperty({ example: 'sess_abc123' })
  @IsString()
  sessionId: string;
}
