import { ApiProperty } from '@nestjs/swagger';
import { Channel, OtpStatus } from '../../../../generated/prisma/enums';

const CHANNEL_VALUES = Object.values(Channel);
const STATUS_VALUES = Object.values(OtpStatus);

export class GenerateOtpResponseDto {
  @ApiProperty({ example: 'xxxxxxxxxxxxxxxx' })
  challengeId: string;

  @ApiProperty()
  expiresAt: Date;

  @ApiProperty({ enum: CHANNEL_VALUES, example: 'RCS' })
  channel: Channel;

  @ApiProperty({ enum: STATUS_VALUES, example: 'PENDING' })
  status: OtpStatus;
}

export class VerifyOtpResponseDto {
  @ApiProperty({ example: true })
  valid: boolean;

  @ApiProperty({ required: false, example: 'INVALID_CODE' })
  reason?: string;

  @ApiProperty({ required: false, example: 2 })
  remainingAttempts?: number;
}

export class ChallengeStatusResponseDto {
  @ApiProperty({ enum: STATUS_VALUES, example: 'PENDING' })
  status: OtpStatus;
}
