import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  BadRequestException,
} from '@nestjs/common';
import {
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  randomUUID,
} from 'node:crypto';
import * as bcrypt from 'bcrypt';
import {
  SmsmodeRcsClient,
  RcsError,
  AuthError,
  RateLimitError,
  SmsModeApiError,
  type RcsMessage,
  type RcsSuggestion,
  type RcsCardContent,
  type RcsBody,
} from '@smsmode/rcs';
import { ConfigService } from '@nestjs/config';
import {
  EnvironmentVariables,
  ServerConfig,
} from '../_utils/configs/env.config';
import { PrismaService } from '../prisma/prisma.service';
import { OtpSecurityService } from './otp-security.service';
import { CreateOtpCodeDto } from './_utils/dtos/request/create-otp-code.dto';
import { OtpMode, OtpStatus } from '../generated/prisma/enums';
import { VerifyOtpCodeDto } from './_utils/dtos/request/verify-otp-code.dto';
import { CreateOtpAppDto } from './_utils/dtos/request/create-otp-app.dto';
import { UpdateAppConfigDto } from './_utils/dtos/request/update-app-config.dto';
import { OtpApp } from '../generated/prisma/client';

@Injectable()
export class OtpSmsModeService {
  private readonly logger = new Logger(OtpSmsModeService.name);
  private readonly client: SmsmodeRcsClient;
  private readonly phoneHmacSecret: string;
  private readonly publicUrl: string;

  constructor(
    private readonly configService: ConfigService<EnvironmentVariables, true>,
    private readonly prisma: PrismaService,
    private readonly security: OtpSecurityService,
  ) {
    const serverConfig = this.configService.get<ServerConfig>('SERVER');
    this.client = new SmsmodeRcsClient({ apiKey: serverConfig.OTP_API_KEY });
    this.phoneHmacSecret = serverConfig.PHONE_HMAC_SECRET;
    this.publicUrl = serverConfig.PUBLIC_URL;
  }

  async generateOtp(dto: CreateOtpCodeDto, app: OtpApp, clientIp: string) {
    const phoneHash = this.hmacPhone(dto.phoneNumber);

    this.security.validateCountry(dto.phoneNumber, app.allowedCountries);
    this.security.checkAndRecordIpRate(clientIp, app.rateLimitIp);
    this.security.checkAndRecordPhoneRate(phoneHash, app.rateLimitPhone);
    this.security.checkResendCooldown(app.id, phoneHash, app.resendCooldown);
    await this.security.checkReputation(phoneHash, clientIp);

    if (app.otpMode === OtpMode.GOOGLE_PROMPT) {
      return this.generateGooglePromptOtp(dto, app, phoneHash);
    }

    return this.generateClassicOtp(dto, app, phoneHash);
  }

  private async generateClassicOtp(
    dto: CreateOtpCodeDto,
    app: OtpApp,
    phoneHash: string,
  ) {
    const code = Array.from({ length: app.codeLength }, () =>
      randomInt(10),
    ).join('');

    const codeHash = await bcrypt.hash(code, 10);
    const tapToken = app.oneTapEnabled ? randomUUID() : null;

    const description = this.buildClassicDescription(
      app.messageTemplate,
      code,
      app.ttlSeconds,
      app.senderLabel,
    );

    const cardSuggestions: RcsSuggestion[] = [];

    if (tapToken) {
      cardSuggestions.push({
        type: 'OPEN_URL',
        text: 'Valider la connexion',
        postbackData: 'verify_tap',
        url: `${this.publicUrl}/api/v1/otp/tap?token=${tapToken}`,
      });
    }

    const bodySuggestions: RcsSuggestion[] = [];

    if (app.reportEnabled && tapToken) {
      bodySuggestions.push({
        type: 'REPLY',
        text: "Ce n'est pas moi",
        postbackData: `report:${tapToken}`,
      });
    }

    const resolvedLogoUrl = await this.resolveLogoUrl(app.logoUrl);

    const cardContent: RcsCardContent = {
      title: app.cardTitle,
      description,
      ...(resolvedLogoUrl
        ? { media: { fileUrl: resolvedLogoUrl, height: 'SHORT' as const } }
        : {}),
      suggestions: cardSuggestions,
    };

    const body: RcsBody = {
      type: 'CARD',
      orientation: 'VERTICAL',
      content: cardContent,
      suggestions: bodySuggestions,
    };

    const message = await this.sendRcs(app, dto.phoneNumber, tapToken, body);
    const expiresAt = new Date(Date.now() + app.ttlSeconds * 1_000);

    const txn = await this.prisma.otpTransaction.create({
      data: {
        appId: app.id,
        phoneHash,
        sessionId: dto.sessionId,
        codeHash,
        tapToken,
        channel: message.type,
        expiresAt,
      },
    });

    this.security.recordSent(app.id, phoneHash);
    this.logger.log(`OTP CLASSIC généré — challenge=${txn.id}`);

    return {
      challengeId: txn.id,
      expiresAt,
      channel: message.type,
      status: txn.status,
    };
  }

  private async generateGooglePromptOtp(
    dto: CreateOtpCodeDto,
    app: OtpApp,
    phoneHash: string,
  ) {
    const promptDigit = randomInt(10);
    const codeHash = await bcrypt.hash(String(promptDigit), 10);
    const tapToken = randomUUID();
    const txnId = randomUUID();

    const [decoy1, decoy2] = this.buildDecoys(promptDigit);

    const allChoices = this.shuffleArray([
      { digit: promptDigit, token: tapToken, correct: true },
      { digit: decoy1, token: randomUUID(), correct: false },
      { digit: decoy2, token: randomUUID(), correct: false },
    ]);

    const resolvedLogoUrl = await this.resolveLogoUrl(app.logoUrl);

    const digitSuggestions: RcsSuggestion[] = allChoices.map(
      ({ digit, token, correct }) => ({
        type: 'OPEN_URL',
        text: String(digit),
        postbackData: `prompt:${token}`,
        url: correct
          ? `${this.publicUrl}/api/v1/otp/tap?token=${token}`
          : `${this.publicUrl}/api/v1/otp/tap?token=${token}&decoy=${txnId}`,
      }),
    );

    const bodySuggestions: RcsSuggestion[] = [];

    if (app.reportEnabled) {
      bodySuggestions.push({
        type: 'REPLY',
        text: "Ce n'est pas moi",
        postbackData: `report:${tapToken}`,
      });
    }

    const ttlMin = Math.max(1, Math.round(app.ttlSeconds / 60));

    const cardContent: RcsCardContent = {
      title: app.cardTitle,
      description: `Appuyez sur le chiffre affiché sur votre écran. Valable ${ttlMin} min.`,
      ...(resolvedLogoUrl
        ? { media: { fileUrl: resolvedLogoUrl, height: 'SHORT' as const } }
        : {}),
      suggestions: digitSuggestions,
    };

    const body: RcsBody = {
      type: 'CARD',
      orientation: 'HORIZONTAL',
      content: cardContent,
      suggestions: bodySuggestions,
    };

    const message = await this.sendRcs(app, dto.phoneNumber, tapToken, body);
    const expiresAt = new Date(Date.now() + app.ttlSeconds * 1_000);

    const txn = await this.prisma.otpTransaction.create({
      data: {
        id: txnId,
        appId: app.id,
        phoneHash,
        sessionId: dto.sessionId,
        codeHash,
        tapToken,
        channel: message.type,
        expiresAt,
        promptDigit,
      },
    });

    this.security.recordSent(app.id, phoneHash);
    this.logger.log(
      `OTP GOOGLE_PROMPT généré — challenge=${txn.id} digit=${promptDigit}`,
    );

    return {
      challengeId: txn.id,
      expiresAt,
      channel: message.type,
      status: txn.status,
      promptDigit,
    };
  }

  async verifyOtp(dto: VerifyOtpCodeDto) {
    const txn = await this.prisma.otpTransaction.findUnique({
      where: { id: dto.challengeId },
      include: { app: true },
    });

    if (!txn) return { valid: false, reason: 'NOT_FOUND' };
    if (txn.status !== OtpStatus.PENDING)
      return { valid: false, reason: txn.status };

    if (txn.expiresAt < new Date()) {
      await this.prisma.otpTransaction.update({
        where: { id: txn.id },
        data: { status: OtpStatus.EXPIRED },
      });
      return { valid: false, reason: 'EXPIRED' };
    }

    if (txn.attempts >= txn.app.maxAttempts) {
      await this.prisma.otpTransaction.update({
        where: { id: txn.id },
        data: { status: OtpStatus.BLOCKED },
      });
      return { valid: false, reason: 'BLOCKED' };
    }

    const valid = await bcrypt.compare(dto.code, txn.codeHash);

    if (valid) {
      await this.prisma.otpTransaction.update({
        where: { id: txn.id },
        data: { status: OtpStatus.VERIFIED },
      });
      this.logger.log(`OTP vérifié manuellement — challenge=${txn.id}`);
      return { valid: true };
    }

    const newAttempts = txn.attempts + 1;
    const blocked = newAttempts >= txn.app.maxAttempts;

    await this.prisma.otpTransaction.update({
      where: { id: txn.id },
      data: {
        attempts: newAttempts,
        status: blocked ? OtpStatus.BLOCKED : OtpStatus.PENDING,
      },
    });

    return {
      valid: false,
      reason: blocked ? 'BLOCKED' : 'INVALID_CODE',
      remainingAttempts: txn.app.maxAttempts - newAttempts,
    };
  }

  async verifyTap(tapToken: string, decoyTxnId?: string) {
    if (decoyTxnId) {
      const txn = await this.prisma.otpTransaction.findUnique({
        where: { id: decoyTxnId },
        include: { app: true },
      });
      if (txn?.status === OtpStatus.PENDING) {
        await this.prisma.otpTransaction.update({
          where: { id: decoyTxnId },
          data: { status: OtpStatus.BLOCKED },
        });
      }
      const base = txn?.app?.verifyRedirectUrl ?? `${this.publicUrl}/tap-error`;
      return { redirectUrl: `${base}?success=false&reason=WRONG_DIGIT` };
    }

    const txn = await this.prisma.otpTransaction.findUnique({
      where: { tapToken },
      include: { app: true },
    });

    const failRedirect = (reason: string) => {
      const base = txn?.app?.verifyRedirectUrl ?? `${this.publicUrl}/tap-error`;
      return { redirectUrl: `${base}?success=false&reason=${reason}` };
    };

    if (!txn) return failRedirect('NOT_FOUND');
    if (!txn.app.oneTapEnabled) return failRedirect('TAP_DISABLED');
    if (txn.tapUsed) return failRedirect('TOKEN_ALREADY_USED');
    if (txn.status !== OtpStatus.PENDING) return failRedirect(txn.status);

    if (txn.expiresAt < new Date()) {
      await this.prisma.otpTransaction.update({
        where: { id: txn.id },
        data: { status: OtpStatus.EXPIRED },
      });
      return failRedirect('EXPIRED');
    }

    await this.prisma.otpTransaction.update({
      where: { id: txn.id },
      data: { status: OtpStatus.VERIFIED, tapUsed: true },
    });

    this.logger.log(`OTP validé en 1 clic — challenge=${txn.id}`);
    return { redirectUrl: `${txn.app.verifyRedirectUrl}?success=true` };
  }

  async getStatus(challengeId: string) {
    const txn = await this.prisma.otpTransaction.findUnique({
      where: { id: challengeId },
      select: { status: true, expiresAt: true, id: true },
    });

    if (!txn)
      throw new NotFoundException(`Challenge ${challengeId} introuvable`);

    if (txn.status === OtpStatus.PENDING && txn.expiresAt < new Date()) {
      await this.prisma.otpTransaction.update({
        where: { id: txn.id },
        data: { status: OtpStatus.EXPIRED },
      });
      return { status: OtpStatus.EXPIRED };
    }

    return { status: txn.status };
  }

  async createApp(dto: CreateOtpAppDto) {
    const apiKey = `sk_${randomBytes(24).toString('base64url')}`;
    const apiKeyHash = createHash('sha256').update(apiKey).digest('hex');

    const app = await this.prisma.otpApp.create({
      data: { ...dto, apiKey: apiKeyHash },
    });

    this.logger.log(`App OTP créée — id=${app.id} name=${app.name}`);
    return { id: app.id, name: app.name, apiKey };
  }

  getAppConfig(app: OtpApp) {
    return {
      id: app.id,
      ttlSeconds: app.ttlSeconds,
      codeLength: app.codeLength,
      maxAttempts: app.maxAttempts,
      resendCooldown: app.resendCooldown,
      oneTapEnabled: app.oneTapEnabled,
      allowedCountries: app.allowedCountries,
      rateLimitPhone: app.rateLimitPhone,
      rateLimitIp: app.rateLimitIp,
      reportEnabled: app.reportEnabled,
    };
  }

  async updateAppConfig(app: OtpApp, dto: UpdateAppConfigDto) {
    const updated = await this.prisma.otpApp.update({
      where: { id: app.id },
      data: dto,
    });

    this.logger.log(`Config mise à jour — id=${app.id}`);
    return {
      id: updated.id,
      ttlSeconds: updated.ttlSeconds,
      codeLength: updated.codeLength,
      maxAttempts: updated.maxAttempts,
      resendCooldown: updated.resendCooldown,
      oneTapEnabled: updated.oneTapEnabled,
      allowedCountries: updated.allowedCountries,
      rateLimitPhone: updated.rateLimitPhone,
      rateLimitIp: updated.rateLimitIp,
      reportEnabled: updated.reportEnabled,
    };
  }

  private hmacPhone(phone: string): string {
    return createHmac('sha256', this.phoneHmacSecret)
      .update(phone)
      .digest('hex');
  }

  private buildClassicDescription(
    template: string,
    code: string,
    ttlSeconds: number,
    brand: string,
  ): string {
    const ttlMin = Math.max(1, Math.round(ttlSeconds / 60));
    const spacedCode = code.split('').join('  ');
    const intro = template
      .replace(/{{code}}/g, '')
      .replace(/{{ttl}}/g, String(ttlMin))
      .replace(/{{brand}}/g, brand)
      .trim();

    return `${intro}\n\n\u2015 \u2015 \u2015 \u2015 \u2015 \u2015\n\n    ${spacedCode}\n\n\u2015 \u2015 \u2015 \u2015 \u2015 \u2015`;
  }

  private buildDecoys(correct: number): [number, number] {
    const decoys: number[] = [];
    while (decoys.length < 2) {
      const d = randomInt(10);
      if (d !== correct && !decoys.includes(d)) decoys.push(d);
    }
    return [decoys[0] as number, decoys[1] as number];
  }

  private shuffleArray<T>(arr: readonly T[]): T[] {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      const tmp = result[i] as T;
      result[i] = result[j] as T;
      result[j] = tmp;
    }
    return result;
  }

  private async resolveLogoUrl(logoUrl: string | null): Promise<string | null> {
    if (!logoUrl) return null;
    return (await this.isLogoUrlReachable(logoUrl)) ? logoUrl : null;
  }

  private async sendRcs(
    app: OtpApp,
    phoneNumber: string,
    tapToken: string | null,
    body: RcsBody,
  ): Promise<RcsMessage> {
    try {
      return await this.client.send({
        recipient: { to: phoneNumber },
        validity: { amount: app.ttlSeconds, timeUnit: 'SECONDS' },
        ...(tapToken ? { refClient: tapToken } : {}),
        callbackUrlMo: `${this.publicUrl}/api/v1/webhook/rcs`,
        body,
      });
    } catch (err) {
      if (err instanceof AuthError)
        throw new InternalServerErrorException(
          'Authentification provider OTP échouée',
        );
      if (err instanceof RateLimitError)
        throw new ServiceUnavailableException(
          `Provider OTP en surcharge — réessayez dans ${err.retryAfter ?? 60}s`,
        );
      if (err instanceof SmsModeApiError)
        throw new BadRequestException(
          `Envoi OTP échoué : ${err.detail} (code: ${err.errorCode})`,
        );
      if (err instanceof RcsError)
        throw new ServiceUnavailableException(
          `Erreur provider OTP : ${err.message}`,
        );
      throw err;
    }
  }

  private async isLogoUrlReachable(url: string): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4_000);
      const res = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        this.logger.warn(`Logo URL inaccessible (HTTP ${res.status}) : ${url}`);
        return false;
      }

      const contentType = res.headers.get('content-type') ?? '';
      if (!contentType.startsWith('image/')) {
        this.logger.warn(`Logo URL non-image (${contentType}) : ${url}`);
        return false;
      }

      return true;
    } catch (err: unknown) {
      const reason =
        err instanceof Error && err.name === 'AbortError'
          ? 'timeout (4s)'
          : String(err);
      this.logger.warn(`Logo URL injoignable (${reason}) : ${url}`);
      return false;
    }
  }
}
