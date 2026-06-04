import { Body, Controller, Post } from '@nestjs/common';
import { OtpSmsModeService } from './otp-sms-mode.service';
import { ApiOperation } from '@nestjs/swagger';
import { CreateOtpCodeDto } from './_utils/dtos/request/create-otp-code.dto';
import { VerifyOtpCodeDto } from './_utils/dtos/request/verify-otp-code.dto';
import { CreateOtpAppDto } from './_utils/dtos/request/create-otp-app.dto';

@Controller('otp-sms-mode')
export class OtpSmsModeController {
  constructor(private readonly otpSmsModeService: OtpSmsModeService) {}

  @ApiOperation({ summary: 'Generate OTP and send via SMS' })
  @Post('generate')
  generate(@Body() dto: CreateOtpCodeDto) {
    return this.otpSmsModeService.generateOtp(dto);
  }

  @ApiOperation({ summary: 'Verify OTP code' })
  @Post('verify')
  verify(@Body() dto: VerifyOtpCodeDto) {
    return this.otpSmsModeService.verifyOtp(dto);
  }

  @ApiOperation({ summary: 'Create OTP app config' })
  @Post('apps')
  createApp(@Body() dto: CreateOtpAppDto) {
    return this.otpSmsModeService.createApp(dto);
  }
}
