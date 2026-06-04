import {
  Injectable,
  ForbiddenException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { parsePhoneNumberFromString } from 'libphonenumber-js';

@Injectable()
export class OtpSecurityService {
  private readonly logger = new Logger(OtpSecurityService.name);

  private readonly phoneBuckets = new Map<string, number[]>();

  private readonly ipBuckets = new Map<string, number[]>();

  private readonly lastSentAt = new Map<string, number>();

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

    if (last !== undefined) {
      const elapsedMs = Date.now() - last;
      const remainingMs = cooldownSeconds * 1_000 - elapsedMs;

      if (remainingMs > 0) {
        const remainingSec = Math.ceil(remainingMs / 1_000);
        throw new UnauthorizedException(
          `Veuillez attendre encore ${remainingSec}s avant de renvoyer un OTP`,
        );
      }
    }
  }

  recordSent(appId: string, phoneHash: string): void {
    this.lastSentAt.set(`${appId}:${phoneHash}`, Date.now());
  }

  validateCountry(phoneNumber: string, allowedCountries: string[]): void {
    if (!allowedCountries || allowedCountries.length === 0) return;

    const parsed = parsePhoneNumberFromString(phoneNumber);

    if (!parsed || !parsed.country) {
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
      } else {
        this.phoneBuckets.set(key, fresh);
      }
    }

    for (const [key, ts] of this.ipBuckets) {
      const fresh = ts.filter((t) => t > windowStart);
      if (fresh.length === 0) {
        this.ipBuckets.delete(key);
        purgedIp++;
      } else {
        this.ipBuckets.set(key, fresh);
      }
    }

    const cooldownWindow = Date.now() - 24 * 60 * 60 * 1_000;
    for (const [key, ts] of this.lastSentAt) {
      if (ts < cooldownWindow) {
        this.lastSentAt.delete(key);
        purgedCooldown++;
      }
    }

    this.logger.debug(
      `Purge mémoire : ${purgedPhone} phone buckets, ${purgedIp} IP buckets, ${purgedCooldown} cooldowns supprimés`,
    );
  }
}
