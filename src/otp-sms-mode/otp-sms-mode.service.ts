import {
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
  BadRequestException,
  BadGatewayException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { OTP } from 'otplib';
import {
  SmsmodeRcsClient,
  RcsError,
  AuthError,
  RateLimitError,
  SmsModeHttpError,
  type RcsMessage,
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

type OtpEntry = {
  secret: string;
  expiresAt: number;
  attempts: number;
};

@Injectable()
export class OtpSmsModeService {
  private readonly client: SmsmodeRcsClient;
  private readonly otp = new OTP({ strategy: 'hotp' });
  private readonly store = new Map<string, OtpEntry>();
  private readonly maxAttempts = 3;
  private readonly ttlMs = 5 * 60 * 1000;

  constructor(
    private readonly configService: ConfigService<EnvironmentVariables, true>,
    private readonly prisma: PrismaService,
  ) {
    this.client = new SmsmodeRcsClient({
      apiKey: this.configService.get<ServerConfig>('SERVER').OTP_API_KEY,
    });
  }

  // async generateOtp(dto: CreateOtpCodeDto) {
  //   const secret = this.otp.generateSecret();
  //   const token = await this.otp.generate({ secret, counter: 0 });

  //   let message: RcsMessage;
  //   try {
  //     message = await this.client.send({
  //       recipient: { to: dto.phoneNumber },
  //       body: { type: 'TEXT', text: `Votre code : ${token}` },
  //     });
  //   } catch (err) {
  //     if (err instanceof AuthError) {
  //       throw new InternalServerErrorException('OTP provider auth failed');
  //     }
  //     if (err instanceof RateLimitError) {
  //       throw new ServiceUnavailableException('OTP provider rate limited');
  //     }
  //     if (err instanceof RcsError) {
  //       throw new BadRequestException(`OTP send failed: ${err.message}`);
  //     }
  //     throw err;
  //   }

  //   this.store.set(dto.phoneNumber, {
  //     secret,
  //     expiresAt: Date.now() + this.ttlMs,
  //     attempts: 0,
  //   });

  //   return { type: message.type, status: message.status.value };
  // }

    async generateOtp(dto: CreateOtpCodeDto) {
    const secret = this.otp.generateSecret();
    const token = await this.otp.generate({ secret, counter: 0 });

      // TODO HASH


    let message: RcsMessage;
    try {
      message = await this.client.send({
        recipient: { to: dto.phoneNumber },
        body: { 
          type: 'CARD',
          orientation: 'VERTICAL',
          content : 
          {
            title: `Votre code : ${token}`,
            description: 'Cliquez sur le lien pour valider instantanément votre connexion.',
            // media: 
            // {
            //   fileUrl: "https://www.smsmode.com/img/illus-error404.svg", //has to be an URL can be bypassed through ngrok 
            //   height:'MEDIUM'
            // },
            suggestions: [
              {
                //one tap link
                type: 'OPEN_URL', 
                text: 'Valider mon code', 
                postbackData: 'clic_validation_url', 
                url: 'https://www.google.com/' //placeholder
              },
              {
                //reply button 
                type: 'REPLY', 
                text: 'Renvoyer un code', 
                postbackData: 'demande_renvoi_code' //sent to webhook
              }
            ]
          }
        }
      });
    } catch (err) {
      if (err instanceof AuthError) {
        throw new InternalServerErrorException('OTP provider auth failed');
      }
      if (err instanceof RateLimitError) {
        throw new ServiceUnavailableException('OTP provider rate limited');
      }
      if (err instanceof RcsError) {
        throw new BadRequestException(`OTP send failed: ${err.message}`);
      }
      if (err instanceof SmsModeHttpError) //5xx err 
      {
        console.error(`Erreur Serveur smsmode HTTP ${err.httpStatus} ${err.statusText}`);
        throw new BadGatewayException("Le service d'envoi RCS est temporairement indisponible");
      }
      throw err;
    }

    this.store.set(dto.phoneNumber, {
      secret,
      expiresAt: Date.now() + this.ttlMs,
      attempts: 0,
    });

    return { type: message.type, status: message.status.value };
  }

  async verifyOtp(dto: VerifyOtpCodeDto) {
    const entry = this.store.get(dto.phoneNumber);
    if (!entry) return { valid: false };

    if (Date.now() > entry.expiresAt || entry.attempts >= this.maxAttempts) {
      this.store.delete(dto.phoneNumber);
      return { valid: false };
    }

    entry.attempts++;

    const { valid } = await this.otp.verify({
      secret: entry.secret,
      token: dto.token,
      counter: 0,
    });

    if (valid) {
      this.store.delete(dto.phoneNumber);
      return { valid: true };
    }

    const remainingAttempts = this.maxAttempts - entry.attempts;
    if (remainingAttempts <= 0) this.store.delete(dto.phoneNumber);
    return { valid: false };
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
