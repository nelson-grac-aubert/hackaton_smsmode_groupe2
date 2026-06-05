import { Injectable } from '@nestjs/common';
import {
  DiskHealthIndicator,
  HealthCheckService,
  MemoryHealthIndicator,
} from '@nestjs/terminus';

@Injectable()
export class AppService {
  constructor(
    private readonly healthCheckService: HealthCheckService,
    private readonly memoryHealthIndicator: MemoryHealthIndicator,
    private readonly diskHealthIndicator: DiskHealthIndicator,
  ) {}

  private readonly HEALTH_LIMITS = {
    processMemoryBytes: 300 * 1024 * 1024,
    rssMemoryBytes: 300 * 1024 * 1024,
    diskUsageThreshold: 0.5,
  } as const;

  getHealth() {
    const checks = [
      () => this.checkHeap(),
      () => this.checkRSS(),
      () => this.checkDisk(),
    ];

    return this.healthCheckService.check(checks);
  }

  private checkHeap() {
    return this.memoryHealthIndicator.checkHeap(
      'memory_heap',
      this.HEALTH_LIMITS.processMemoryBytes,
    );
  }

  private checkRSS() {
    return this.memoryHealthIndicator.checkRSS(
      'memory_rss',
      this.HEALTH_LIMITS.rssMemoryBytes,
    );
  }

  private checkDisk() {
    return this.diskHealthIndicator.checkStorage('disk_health', {
      thresholdPercent: this.HEALTH_LIMITS.diskUsageThreshold,
      path: '/',
    });
  }
}
