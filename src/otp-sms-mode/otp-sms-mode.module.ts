import { Module } from '@nestjs/common';
import { OtpSmsModeService } from './otp-sms-mode.service';
import { OtpSmsModeController } from './otp-sms-mode.controller';

@Module({
  controllers: [OtpSmsModeController],
  providers: [OtpSmsModeService],
})
export class OtpSmsModeModule {}
