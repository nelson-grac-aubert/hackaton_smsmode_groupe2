import {
  Injectable,
  InternalServerErrorException,
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
  type RcsMessage,
  RcsSuggestion,
} from '@smsmode/rcs';
import { ConfigService } from '@nestjs/config';
import {
  EnvironmentVariables,
  ServerConfig,
} from '../_utils/configs/env.config';
import { CreateOtpCodeDto } from './_utils/dtos/request/create-otp-code.dto';
import { VerifyOtpCodeDto } from './_utils/dtos/request/verify-otp-code.dto';
import { CreateOtpAppDto } from './_utils/dtos/request/create-otp-app.dto';
import { PrismaService } from '../prisma/prisma.service';
import { Channel } from '../generated/prisma/enums';

@Injectable()
export class OtpSmsModeService {
  private readonly client: SmsmodeRcsClient;

  constructor(
    private readonly configService: ConfigService<EnvironmentVariables, true>,
    private readonly prisma: PrismaService,
  ) {
    this.client = new SmsmodeRcsClient({
      apiKey: this.configService.get<ServerConfig>('SERVER').OTP_API_KEY,
    });
  }

  async generateOtp(dto: CreateOtpCodeDto) {
    const app = await this.prisma.otpApp.findUnique({
      where: { id: dto.appId },
    });
    if (!app) throw new NotFoundException(`App ${dto.appId} not found`);

    const code = Array.from({ length: app.codeLength }, () =>
      randomInt(10),
    ).join('');

    const phoneHash = createHmac(
      'sha256',
      process.env.PHONE_HMAC_SECRET ?? 'dev_secret',
    )
      .update(dto.phoneNumber)
      .digest('hex');

    const codeHash = await bcrypt.hash(code, 10);
    const tapToken = app.oneTapEnabled ? randomUUID() : null;

    const ttlMin = Math.max(1, Math.round(app.ttlSeconds / 60));

    const prettyCode =
      code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : code;

    const description = `Votre code ${app.name} est ${prettyCode}, valable ${ttlMin} min.`;

    const cardSuggestions: RcsSuggestion[] = [];

    if (tapToken) {
      cardSuggestions.push({
        type: 'OPEN_URL',
        text: '✓ Valider en 1 tap',
        postbackData: `verify_tap:${tapToken}`,
        url: `${this.configService.get<ServerConfig>('SERVER').PUBLIC_URL}/otp/tap/${tapToken}`,
      });
    }

    if (app.reportEnabled) {
      cardSuggestions.push({
        type: 'REPLY',
        text: "Ce n'est pas moi",
        postbackData: `report:${tapToken ?? 'na'}`,
      });
    }

    let message: RcsMessage;
    try {
      message = await this.client.send({
        recipient: { to: dto.phoneNumber },
        validity: { amount: app.ttlSeconds, timeUnit: 'SECONDS' },
        body: {
          type: 'CARD',
          orientation: 'VERTICAL',
          content: {
            title: app.cardTitle,
            description,
            ...(app.logoUrl
              ? { media: { fileUrl: app.logoUrl, height: 'SHORT' as const } }
              : {}),
            suggestions: cardSuggestions,
          },
        },
      });
    } catch (err) {
      if (err instanceof AuthError)
        throw new InternalServerErrorException('OTP provider auth failed');
      if (err instanceof RateLimitError)
        throw new ServiceUnavailableException('OTP provider rate limited');
      if (err instanceof RcsError)
        throw new BadRequestException(`OTP send failed: ${err.message}`);
      throw err;
    }

    const expiresAt = new Date(Date.now() + app.ttlSeconds * 1_000);
    const channel =
      message.type?.toUpperCase() === 'RCS' ? Channel.RCS : Channel.SMS;

    const txn = await this.prisma.otpTransaction.create({
      data: {
        appId: app.id,
        phoneHash,
        sessionId: dto.sessionId,
        codeHash,
        tapToken,
        channel,
        expiresAt,
      },
    });

    return { challengeId: txn.id, expiresAt, channel, status: txn.status };
  }

  async verifyOtp(dto: VerifyOtpCodeDto) {
    const txn = await this.prisma.otpTransaction.findUnique({
      where: { id: dto.challengeId },
      include: { app: true },
    });

    if (!txn) return { valid: false, reason: 'NOT_FOUND' };

    if (txn.status !== 'PENDING') return { valid: false, reason: txn.status };

    if (txn.expiresAt < new Date()) {
      await this.prisma.otpTransaction.update({
        where: { id: txn.id },
        data: { status: 'EXPIRED' },
      });
      return { valid: false, reason: 'EXPIRED' };
    }

    if (txn.attempts >= txn.app.maxAttempts) {
      await this.prisma.otpTransaction.update({
        where: { id: txn.id },
        data: { status: 'BLOCKED' },
      });
      return { valid: false, reason: 'BLOCKED' };
    }

    const valid = await bcrypt.compare(dto.code, txn.codeHash);

    if (valid) {
      await this.prisma.otpTransaction.update({
        where: { id: txn.id },
        data: { status: 'VERIFIED' },
      });
      return { valid: true };
    }

    const newAttempts = txn.attempts + 1;
    const blocked = newAttempts >= txn.app.maxAttempts;
    await this.prisma.otpTransaction.update({
      where: { id: txn.id },
      data: { attempts: newAttempts, status: blocked ? 'BLOCKED' : 'PENDING' },
    });

    return {
      valid: false,
      reason: blocked ? 'BLOCKED' : 'INVALID_CODE',
      remainingAttempts: txn.app.maxAttempts - newAttempts,
    };
  }

  async createApp(dto: CreateOtpAppDto) {
    const apiKey = `sk_${randomBytes(24).toString('base64url')}`;
    const apiKeyHash = createHash('sha256').update(apiKey).digest('hex');

    const app = await this.prisma.otpApp.create({
      data: { ...dto, apiKey: apiKeyHash },
    });

    return { id: app.id, name: app.name, apiKey };
  }
}
