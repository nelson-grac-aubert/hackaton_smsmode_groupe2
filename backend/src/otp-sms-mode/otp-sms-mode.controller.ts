import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Redirect,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { OtpSmsModeService } from './otp-sms-mode.service';
import { CreateOtpCodeDto } from './_utils/dtos/request/create-otp-code.dto';
import { VerifyOtpCodeDto } from './_utils/dtos/request/verify-otp-code.dto';
import { CreateOtpAppDto } from './_utils/dtos/request/create-otp-app.dto';
import { UpdateAppConfigDto } from './_utils/dtos/request/update-app-config.dto';
import { VerifyTapQueryDto } from './_utils/dtos/request/verify-tap-query.dto';
import { CurrentApp } from './_utils/decorator/current-app.decorator';
import { ApiKeyGuard, type OtpRequest } from './_utils/guards/api-key.guard';
import { type OtpApp } from '../generated/prisma/client';

@ApiTags('OTP')
@Controller('otp')
export class OtpSmsModeController {
  constructor(private readonly otpSmsModeService: OtpSmsModeService) {}

  @ApiOperation({ summary: 'Génère et envoie un OTP via RCS' })
  @ApiSecurity('ApiKey')
  @UseGuards(ApiKeyGuard)
  @Post('generate')
  generate(
    @Body() dto: CreateOtpCodeDto,
    @CurrentApp() app: OtpApp,
    @Req() req: OtpRequest,
  ) {
    const clientIp =
      (req.headers['x-forwarded-for'] as string | undefined)
        ?.split(',')[0]
        ?.trim() ??
      req.socket.remoteAddress ??
      '0.0.0.0';
    return this.otpSmsModeService.generateOtp(dto, app, clientIp);
  }

  @ApiOperation({ summary: 'Vérifie un code OTP saisi manuellement' })
  @ApiSecurity('ApiKey')
  @UseGuards(ApiKeyGuard)
  @Post('verify')
  verify(@Body() dto: VerifyOtpCodeDto) {
    return this.otpSmsModeService.verifyOtp(dto);
  }

  @ApiOperation({
    summary: "Valide l'OTP en 1 tap depuis la RCS Card (mobile → redirect)",
  })
  @Get('tap')
  @Redirect()
  async verifyTap(@Query() query: VerifyTapQueryDto) {
    const { redirectUrl } = await this.otpSmsModeService.verifyTap(
      query.token,
      query.decoy,
    );
    return { url: redirectUrl, statusCode: 302 };
  }

  @ApiOperation({ summary: "Retourne le statut actuel d'un challenge" })
  @ApiSecurity('ApiKey')
  @UseGuards(ApiKeyGuard)
  @Get('status/:challengeId')
  getStatus(@Param('challengeId') challengeId: string) {
    return this.otpSmsModeService.getStatus(challengeId);
  }

  @ApiOperation({ summary: "Crée une configuration d'app OTP avec sa clé API" })
  @ApiResponse({
    status: 201,
    description: 'App créée — la clé API est retournée une seule fois',
  })
  @Post('apps')
  createApp(@Body() dto: CreateOtpAppDto) {
    return this.otpSmsModeService.createApp(dto);
  }

  @ApiOperation({ summary: "Retourne la configuration de sécurité de l'app" })
  @ApiSecurity('ApiKey')
  @UseGuards(ApiKeyGuard)
  @Get('apps/config')
  getConfig(@CurrentApp() app: OtpApp) {
    return this.otpSmsModeService.getAppConfig(app);
  }

  @ApiOperation({ summary: "Met à jour la configuration de sécurité de l'app" })
  @ApiSecurity('ApiKey')
  @UseGuards(ApiKeyGuard)
  @Patch('apps/config')
  updateConfig(@Body() dto: UpdateAppConfigDto, @CurrentApp() app: OtpApp) {
    return this.otpSmsModeService.updateAppConfig(app, dto);
  }
}
