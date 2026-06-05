import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class VerifyOtpCodeDto {
  @ApiProperty({ example: 'cm_challenge_xyz' })
  @IsString()
  challengeId: string;

  @ApiProperty({ example: '483921' })
  @IsString()
  @Length(4, 10)
  code: string;
}
