import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { OtpSmsModeModule } from './otp-sms-mode/otp-sms-mode.module';
import { TerminusModule } from '@nestjs/terminus';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './_utils/configs/env.config';
import { WebhookModule } from './webhook/webhook.module';
import { StatsModule } from './stats/stats.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      validate: validateEnv,
      isGlobal: true,
      envFilePath: ['.env.development', '.env'],
    }),

    OtpSmsModeModule,
    WebhookModule,
    TerminusModule,
    StatsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
