import { Injectable, Logger } from '@nestjs/common';
import {
  type RcsDeliveryReportPayload,
  type RcsIncomingMessagePayload,
} from '@smsmode/rcs';
import { PrismaService } from '../prisma/prisma.service';
import { OtpStatus } from '../generated/prisma/enums';

const REPORT_BUTTON_TEXT = "🚫 Ce n'est pas moi";

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(private readonly prisma: PrismaService) {}

  async handleMessageResponse(payload: RcsIncomingMessagePayload) {
    const text = payload.body.text?.trim() ?? '';

    if (text === REPORT_BUTTON_TEXT) {
      const tapToken = payload.refClient?.trim();

      if (!tapToken) {
        this.logger.warn(
          `Report MO sans refClient — originMessageId=${payload.originMessageId} ` +
            `(le tapToken n'a pas été transmis via refClient dans le send())`,
        );
        return;
      }

      await this.handleReport(tapToken, payload.originMessageId);
      return;
    }
    this.logger.log(
      `MO reçu non géré : "${text}" — from=${payload.recipient.to}`,
    );
  }

  handleOtpTracking(payload: RcsDeliveryReportPayload): void {
    const { value, detail } = payload.status;

    if (value === 'READ') {
      this.logger.log(`Message ${payload.messageId} lu par le destinataire`);
    } else if (value === 'DELIVERED') {
      this.logger.log(`Message ${payload.messageId} livré`);
    } else if (value === 'UNDELIVERABLE' || value === 'UNDELIVERED') {
      this.logger.warn(
        `Message ${payload.messageId} non livré — status=${value} detail=${detail ?? 'inconnu'}`,
      );
    }
  }

  private async handleReport(tapToken: string, originMessageId: string) {
    const transactionClient = await this.prisma.otpTransaction.findUnique({
      where: { tapToken },
      include: { app: true },
    });

    if (!transactionClient) {
      this.logger.warn(
        `Report MO : tapToken "${tapToken}" inconnu — originMessageId=${originMessageId}`,
      );
      return;
    }

    if (!transactionClient.app.reportEnabled) {
      this.logger.warn(
        `Report MO : signalement désactivé — app=${transactionClient.appId}`,
      );
      return;
    }

    if (transactionClient.tapUsed) {
      this.logger.warn(
        `Report MO : tapToken déjà consommé — challenge=${transactionClient.id}`,
      );
      return;
    }

    if (
      transactionClient.status !== OtpStatus.PENDING &&
      transactionClient.status !== OtpStatus.REPORTED
    ) {
      this.logger.warn(
        `Report MO : challenge déjà dans l'état "${transactionClient.status}" — ignoré`,
      );
      return;
    }

    await this.prisma.otpTransaction.update({
      where: { id: transactionClient.id },
      data: { status: OtpStatus.REPORTED, tapUsed: true },
    });

    this.logger.warn(
      `🚨 OTP signalé via MO webhook — challenge=${transactionClient.id} app=${transactionClient.appId} originMessageId=${originMessageId}`,
    );
  }
}
