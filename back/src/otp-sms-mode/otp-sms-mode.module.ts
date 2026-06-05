import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { OtpSmsModeController } from './otp-sms-mode.controller';
import { OtpSecurityService } from './otp-security.service';
import { OtpSmsModeService } from './otp-sms-mode.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ApiKeyGuard } from './_utils/guards/api-key.guard';

@Module({
  imports: [PrismaModule, ScheduleModule.forRoot()],
  controllers: [OtpSmsModeController],
  providers: [OtpSecurityService, OtpSmsModeService, ApiKeyGuard],
})
export class OtpSmsModeModule {}
