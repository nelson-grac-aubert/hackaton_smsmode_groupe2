import { Module } from '@nestjs/common';
import { OtpSmsModeService } from './otp-sms-mode.service';
import { OtpSmsModeController } from './otp-sms-mode.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [OtpSmsModeController],
  providers: [OtpSmsModeService],
})
export class OtpSmsModeModule {}
