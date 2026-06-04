import { createHash } from 'node:crypto';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { OtpApp } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

export const OTP_APP_REQUEST_KEY = 'otpApp' as const;

export type OtpRequest = Request & {
  [OTP_APP_REQUEST_KEY]: OtpApp;
};

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const rawKey = req.headers['x-api-key'];

    if (!rawKey || typeof rawKey !== 'string') {
      throw new UnauthorizedException('Header x-api-key manquant');
    }

    const keyHash = createHash('sha256').update(rawKey).digest('hex');
    const app = await this.prisma.otpApp.findUnique({
      where: { apiKey: keyHash },
    });

    if (!app) throw new UnauthorizedException('Clé API invalide');

    (req as OtpRequest)[OTP_APP_REQUEST_KEY] = app;
    return true;
  }
}
