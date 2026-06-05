import {
  Injectable,
  ForbiddenException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import {
  EnvironmentVariables,
  ServerConfig,
} from '../_utils/configs/env.config';
import { PrismaService } from '../prisma/prisma.service';
import { OtpStatus } from '../generated/prisma/enums';

interface ProxycheckResult {
  detections?: {
    vpn?: boolean;
    tor?: boolean;
    compromised?: boolean;
    scraper?: boolean;
  };
  risk?: number;
  confidence?: number;
}

@Injectable()
export class OtpSecurityService {
  private readonly logger = new Logger(OtpSecurityService.name);

  private readonly phoneBuckets = new Map<string, number[]>();
  private readonly ipBuckets = new Map<string, number[]>();
  private readonly lastSentAt = new Map<string, number>();
  private readonly resendCount = new Map<string, number>();

  constructor(private readonly prisma: PrismaService) {}

  checkAndRecordPhoneRate(phoneHash: string, maxPerHour: number) {
    const now = Date.now();
    const windowStart = now - 60 * 60 * 1_000;
    const timestamps = (this.phoneBuckets.get(phoneHash) ?? []).filter(
      (t) => t > windowStart,
    );
    if (timestamps.length >= maxPerHour) {
      throw new UnauthorizedException(
        `Ce numéro a dépassé la limite de ${maxPerHour} OTP/heure`,
      );
    }
    timestamps.push(now);
    this.phoneBuckets.set(phoneHash, timestamps);
  }

  checkAndRecordIpRate(ip: string, maxPerHour: number) {
    const now = Date.now();
    const windowStart = now - 60 * 60 * 1_000;
    const timestamps = (this.ipBuckets.get(ip) ?? []).filter(
      (t) => t > windowStart,
    );
    if (timestamps.length >= maxPerHour) {
      throw new UnauthorizedException(
        `Trop de requêtes depuis cette IP (limite : ${maxPerHour}/heure)`,
      );
    }
    timestamps.push(now);
    this.ipBuckets.set(ip, timestamps);
  }

  checkResendCooldown(
    appId: string,
    phoneHash: string,
    cooldownSeconds: number,
  ) {
    if (cooldownSeconds <= 0) return;

    const key = `${appId}:${phoneHash}`;
    const last = this.lastSentAt.get(key);
    if (last === undefined) return;

    const count = this.resendCount.get(key) ?? 0;
    const effectiveCooldown = cooldownSeconds * Math.pow(2, count);
    const remainingMs = effectiveCooldown * 1_000 - (Date.now() - last);

    if (remainingMs > 0) {
      const remainingSec = Math.ceil(remainingMs / 1_000);
      throw new UnauthorizedException(
        `Veuillez attendre encore ${remainingSec}s avant de renvoyer un OTP (tentative ${count + 1})`,
      );
    }
  }

  recordSent(appId: string, phoneHash: string): void {
    const key = `${appId}:${phoneHash}`;
    this.lastSentAt.set(key, Date.now());
    this.resendCount.set(key, (this.resendCount.get(key) ?? 0) + 1);
  }

  validateCountry(phoneNumber: string, allowedCountries: string[]): void {
    if (!allowedCountries || allowedCountries.length === 0) return;
    const parsed = parsePhoneNumberFromString(phoneNumber);
    if (!parsed?.country) {
      throw new ForbiddenException(
        `Impossible de déterminer le pays du numéro ${phoneNumber}`,
      );
    }
    if (!allowedCountries.includes(parsed.country)) {
      throw new ForbiddenException(
        `Le pays "${parsed.country}" n'est pas autorisé pour cette application`,
      );
    }
  }

  async checkIpReputation(ip: string) {
    //en dev
    if (ip === '0.0.0.0' || ip === '127.0.0.1' || ip.startsWith('::')) return;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3_000);

      const res = await fetch(
        `https://proxycheck.io/v2/${ip}?vpn=1&risk=1&cur=0`,
        {
          signal: controller.signal,
        },
      );
      clearTimeout(timeout);

      if (!res.ok) {
        this.logger.warn(`proxycheck.io HTTP ${res.status} pour IP ${ip}`);
        return;
      }

      const data = (await res.json()) as Record<
        string,
        ProxycheckResult | string
      >;
      const result = data[ip] as ProxycheckResult | undefined;

      if (!result) return;

      const { detections, risk } = result;
      const riskFactors: string[] = [];

      if (detections?.vpn) riskFactors.push('VPN');
      if (detections?.tor) riskFactors.push('Tor');
      if (detections?.compromised) riskFactors.push('proxy compromis');
      if (detections?.scraper) riskFactors.push('scraper');

      if (riskFactors.length > 0) {
        this.logger.warn(
          `IP suspecte détectée ${ip} — ${riskFactors.join(', ')}`,
        );
        throw new ForbiddenException(
          `Accès refusé : IP identifiée comme ${riskFactors.join(', ')}`,
        );
      }

      if (typeof risk === 'number' && risk > 66) {
        this.logger.warn(`IP à haut risque ${ip} — score ${risk}/100`);
        throw new ForbiddenException(
          `Accès refusé : score de risque IP trop élevé (${risk}/100)`,
        );
      }
    } catch (err: unknown) {
      if (err instanceof ForbiddenException) throw err;
      const reason =
        err instanceof Error && err.name === 'AbortError'
          ? 'timeout (3s)'
          : String(err);
      this.logger.warn(
        `proxycheck.io injoignable (${reason}) — check IP ignoré`,
      );
    }
  }

  async checkConversionHistory(phoneHash: string): Promise<void> {
    const recent = await this.prisma.otpTransaction.findMany({
      where: { phoneHash },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { status: true },
    });

    if (recent.length < 10) return;

    const verified = recent.filter(
      (t) => t.status === OtpStatus.VERIFIED,
    ).length;
    const rate = verified / recent.length;

    if (rate < 0.1) {
      this.logger.warn(
        `Taux de validation suspect — phoneHash=${phoneHash} rate=${Math.round(rate * 100)}% sur ${recent.length} tentatives`,
      );
      throw new ForbiddenException(
        'Accès refusé : historique de vérification suspect',
      );
    }
  }

  async checkReputation(phoneHash: string, clientIp: string) {
    await Promise.all([
      this.checkIpReputation(clientIp),
      this.checkConversionHistory(phoneHash),
    ]);
  }

  @Cron(CronExpression.EVERY_HOUR)
  purgeStaleEntries(): void {
    const windowStart = Date.now() - 60 * 60 * 1_000;
    let purgedPhone = 0;
    let purgedIp = 0;
    let purgedCooldown = 0;

    for (const [key, ts] of this.phoneBuckets) {
      const fresh = ts.filter((t) => t > windowStart);
      if (fresh.length === 0) {
        this.phoneBuckets.delete(key);
        purgedPhone++;
      } else this.phoneBuckets.set(key, fresh);
    }

    for (const [key, ts] of this.ipBuckets) {
      const fresh = ts.filter((t) => t > windowStart);
      if (fresh.length === 0) {
        this.ipBuckets.delete(key);
        purgedIp++;
      } else this.ipBuckets.set(key, fresh);
    }

    const cooldownWindow = Date.now() - 24 * 60 * 60 * 1_000;
    for (const [key, ts] of this.lastSentAt) {
      if (ts < cooldownWindow) {
        this.lastSentAt.delete(key);
        this.resendCount.delete(key);
        purgedCooldown++;
      }
    }

    this.logger.debug(
      `Purge mémoire : ${purgedPhone} phone buckets, ${purgedIp} IP buckets, ${purgedCooldown} cooldowns supprimés`,
    );
  }
}
