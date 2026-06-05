import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OtpStatus, Channel } from '../generated/prisma/enums';

type Period = '24h' | '7d' | '30d';

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  private getPeriodStart(period: Period): Date {
    const now = new Date();
    switch (period) {
      case '24h':
        return new Date(now.getTime() - 24 * 60 * 60 * 1_000);
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1_000);
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1_000);
    }
  }

  async getOverview(appId: string, period: Period) {
    const since = this.getPeriodStart(period);

    const [total, verified, blocked, reported, rcs, sms] = await Promise.all([
      this.prisma.otpTransaction.count({
        where: { appId, createdAt: { gte: since } },
      }),
      this.prisma.otpTransaction.count({
        where: { appId, createdAt: { gte: since }, status: OtpStatus.VERIFIED },
      }),
      this.prisma.otpTransaction.count({
        where: { appId, createdAt: { gte: since }, status: OtpStatus.BLOCKED },
      }),
      this.prisma.otpTransaction.count({
        where: { appId, createdAt: { gte: since }, status: OtpStatus.REPORTED },
      }),
      this.prisma.otpTransaction.count({
        where: { appId, createdAt: { gte: since }, channel: Channel.RCS },
      }),
      this.prisma.otpTransaction.count({
        where: { appId, createdAt: { gte: since }, channel: Channel.SMS },
      }),
    ]);

    const conversionRate = total > 0 ? Math.round((verified / total) * 100) : 0;
    const fraudRate =
      total > 0 ? Math.round(((blocked + reported) / total) * 100) : 0;

    return {
      period,
      total,
      verified,
      blocked,
      reported,
      conversionRate,
      fraudRate,
      channels: { rcs, sms },
    };
  }

  async getStatusBreakdown(appId: string, period: Period) {
    const since = this.getPeriodStart(period);

    const statuses = [
      OtpStatus.PENDING,
      OtpStatus.VERIFIED,
      OtpStatus.EXPIRED,
      OtpStatus.BLOCKED,
      OtpStatus.REPORTED,
    ];

    const counts = await Promise.all(
      statuses.map((status) =>
        this.prisma.otpTransaction
          .count({ where: { appId, createdAt: { gte: since }, status } })
          .then((count) => ({ status, count })),
      ),
    );

    const total = counts.reduce((sum, c) => sum + c.count, 0);

    return {
      period,
      total,
      breakdown: counts.map(({ status, count }) => ({
        status,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0,
      })),
    };
  }

  async getTimeseries(appId: string, period: Period) {
    const since = this.getPeriodStart(period);

    const transactions = await this.prisma.otpTransaction.findMany({
      where: { appId, createdAt: { gte: since } },
      select: { createdAt: true, status: true },
      orderBy: { createdAt: 'asc' },
    });

    // Groupe par heure (24h) ou par jour (7d/30d)
    const groupByHour = period === '24h';
    const buckets = new Map<
      string,
      { total: number; verified: number; fraud: number }
    >();

    for (const txn of transactions) {
      const date = new Date(txn.createdAt);
      const key = groupByHour
        ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:00`
        : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

      const bucket = buckets.get(key) ?? { total: 0, verified: 0, fraud: 0 };
      bucket.total++;
      if (txn.status === OtpStatus.VERIFIED) bucket.verified++;
      if (txn.status === OtpStatus.BLOCKED || txn.status === OtpStatus.REPORTED)
        bucket.fraud++;
      buckets.set(key, bucket);
    }

    return {
      period,
      granularity: groupByHour ? 'hour' : 'day',
      points: Array.from(buckets.entries()).map(([timestamp, data]) => ({
        timestamp,
        ...data,
      })),
    };
  }

  async getFraudAlerts(appId: string) {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1_000);

    const [reported, blocked, suspiciousPhones] = await Promise.all([
      this.prisma.otpTransaction.findMany({
        where: { appId, status: OtpStatus.REPORTED, updatedAt: { gte: since } },
        orderBy: { updatedAt: 'desc' },
        take: 10,
        select: { id: true, sessionId: true, updatedAt: true, channel: true },
      }),

      this.prisma.otpTransaction.findMany({
        where: { appId, status: OtpStatus.BLOCKED, updatedAt: { gte: since } },
        orderBy: { updatedAt: 'desc' },
        take: 10,
        select: { id: true, sessionId: true, updatedAt: true, attempts: true },
      }),

      // Numéros (phoneHash) avec > 5 transactions échouées sur 7j
      this.prisma.otpTransaction.groupBy({
        by: ['phoneHash'],
        where: {
          appId,
          createdAt: { gte: since },
          status: {
            in: [OtpStatus.BLOCKED, OtpStatus.REPORTED, OtpStatus.EXPIRED],
          },
        },
        _count: { id: true },
        having: { id: { _count: { gt: 5 } } },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),
    ]);

    return {
      period: '7d',
      reported: {
        count: reported.length,
        recent: reported,
      },
      blocked: {
        count: blocked.length,
        recent: blocked,
      },
      suspiciousPhones: suspiciousPhones.map((p) => ({
        phoneHashPrefix: p.phoneHash.slice(0, 8) + '…',
        failedAttempts: p._count.id,
      })),
    };
  }
}
