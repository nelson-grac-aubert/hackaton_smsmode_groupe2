import { Injectable, Logger } from '@nestjs/common';
import {
  type RcsDeliveryReportPayload,
  type RcsIncomingMessagePayload,
} from '@smsmode/rcs';
import { PrismaService } from '../prisma/prisma.service';
import { OtpStatus } from '../generated/prisma/enums';

const REPORT_BUTTON_TEXT = "Ce n'est pas moi";
const CLASSIC_TAP_TEXT = 'Valider la connexion';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(private readonly prisma: PrismaService) {}

  async handleMessageResponse(payload: RcsIncomingMessagePayload) {
    const text = payload.body.text?.trim() ?? '';
    const refClient = payload.refClient?.trim();

    if (text === REPORT_BUTTON_TEXT) {
      if (!refClient) {
        this.logger.warn(
          `Report MO sans refClient — originMessageId=${payload.originMessageId}`,
        );
        return;
      }
      await this.handleReport(refClient, payload.originMessageId);
      return;
    }

    if (text === CLASSIC_TAP_TEXT && refClient) {
      await this.handleClassicTap(refClient, payload.originMessageId);
      return;
    }

    if (/^\d$/.test(text) && refClient) {
      await this.handlePromptTap(refClient, text, payload.originMessageId);
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

  private async handleClassicTap(tapToken: string, originMessageId: string) {
    const txn = await this.prisma.otpTransaction.findUnique({
      where: { tapToken },
    });

    if (!txn || txn.tapUsed || txn.status !== OtpStatus.PENDING) return;

    if (txn.expiresAt < new Date()) {
      await this.prisma.otpTransaction.update({
        where: { id: txn.id },
        data: { status: OtpStatus.EXPIRED },
      });
      return;
    }

    await this.prisma.otpTransaction.update({
      where: { id: txn.id },
      data: { status: OtpStatus.VERIFIED, tapUsed: true },
    });
    this.logger.log(
      `OTP validé via MO one-tap — challenge=${txn.id} originMessageId=${originMessageId}`,
    );
  }

  private async handlePromptTap(tapToken: string, digit: string, originMessageId: string) {
    const txn = await this.prisma.otpTransaction.findUnique({
      where: { tapToken },
    });

    if (!txn || txn.tapUsed || txn.status !== OtpStatus.PENDING) return;

    if (txn.expiresAt < new Date()) {
      await this.prisma.otpTransaction.update({
        where: { id: txn.id },
        data: { status: OtpStatus.EXPIRED },
      });
      return;
    }

    const correct = String(txn.promptDigit) === digit;
    await this.prisma.otpTransaction.update({
      where: { id: txn.id },
      data: { status: correct ? OtpStatus.VERIFIED : OtpStatus.BLOCKED, tapUsed: true },
    });

    if (correct) {
      this.logger.log(
        `OTP GOOGLE_PROMPT vérifié via MO — challenge=${txn.id} digit=${digit}`,
      );
    } else {
      this.logger.warn(
        `OTP GOOGLE_PROMPT chiffre incorrect — challenge=${txn.id} reçu=${digit} attendu=${txn.promptDigit}`,
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
