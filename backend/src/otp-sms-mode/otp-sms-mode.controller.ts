import {
  Body,
  Controller,
  Get,
  Param,
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
    description:
      'Le mobile ouvre cette URL depuis le bouton "Valider en 1 tap". ' +
      'Si le token est valide, redirige vers verifyRedirectUrl?success=true&sessionId=... ' +
      "En cas d'erreur, redirige avec success=false&reason=...",
  })
  @Get('tap')
  @Redirect()
  async verifyTap(@Query() query: VerifyTapQueryDto) {
    const { redirectUrl } = await this.otpSmsModeService.verifyTap(query.token);
    return { url: redirectUrl, statusCode: 302 };
  }

  @ApiOperation({
    summary: "Retourne le statut actuel d'un challenge (polling depuis le PC)",
  })
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
}
