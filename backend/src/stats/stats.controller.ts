import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ApiKeyGuard } from '../otp-sms-mode/_utils/guards/api-key.guard';
import { CurrentApp } from '../otp-sms-mode/_utils/decorator/current-app.decorator';
import { StatsService } from './stats.service';
import type { OtpApp } from '../generated/prisma/client';

@ApiTags('Stats')
@Controller('stats')
@UseGuards(ApiKeyGuard)
@ApiSecurity('ApiKey')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @ApiOperation({ summary: 'Vue globale — KPIs dashboard' })
  @ApiQuery({ name: 'period', enum: ['24h', '7d', '30d'], required: false })
  @Get('overview')
  getOverview(
    @CurrentApp() app: OtpApp,
    @Query('period') period: '24h' | '7d' | '30d' = '24h',
  ) {
    return this.statsService.getOverview(app.id, period);
  }

  @ApiOperation({ summary: 'Répartition des statuts OTP' })
  @ApiQuery({ name: 'period', enum: ['24h', '7d', '30d'], required: false })
  @Get('status-breakdown')
  getStatusBreakdown(
    @CurrentApp() app: OtpApp,
    @Query('period') period: '24h' | '7d' | '30d' = '24h',
  ) {
    return this.statsService.getStatusBreakdown(app.id, period);
  }

  @ApiOperation({ summary: 'Série temporelle — envois par heure ou par jour' })
  @ApiQuery({ name: 'period', enum: ['24h', '7d', '30d'], required: false })
  @Get('timeseries')
  getTimeseries(
    @CurrentApp() app: OtpApp,
    @Query('period') period: '24h' | '7d' | '30d' = '24h',
  ) {
    return this.statsService.getTimeseries(app.id, period);
  }

  @ApiOperation({
    summary: 'Alertes fraude — signalements et blocages récents',
  })
  @Get('fraud')
  getFraudAlerts(@CurrentApp() app: OtpApp) {
    return this.statsService.getFraudAlerts(app.id);
  }
}
