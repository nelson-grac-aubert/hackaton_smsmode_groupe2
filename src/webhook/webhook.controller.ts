import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  parseWebhookPayload,
  isIncomingMessage,
  isDeliveryReport,
  ValidationError,
  RcsWebhookPayload,
} from '@smsmode/rcs';
import { WebhookService } from './webhook.service';

@ApiTags('Webhooks')
@Controller('webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(private readonly webhookService: WebhookService) {}

  @ApiOperation({
    summary: "Point d'entrée unique pour les webhooks smsmode RCS (DLR + MO)",
    description:
      "Pour ngrok : remplacer PUBLIC_URL par l'URL ngrok dans le .env.",
  })
  @Post('rcs')
  @HttpCode(HttpStatus.OK)
  async handleRcsWebhook(@Body() body: unknown) {
    let payload: RcsWebhookPayload;
    try {
      payload = parseWebhookPayload(body);
    } catch (err) {
      if (err instanceof ValidationError) {
        this.logger.warn(`Webhook payload invalide : ${err.message}`);
        throw new BadRequestException('Payload webhook invalide');
      }
      throw err;
    }

    if (isIncomingMessage(payload)) {
      this.logger.log(
        `Webhook MO reçu — from=${payload.recipient.to} text="${payload.body.text}" originMessageId=${payload.originMessageId}`,
      );
      await this.webhookService.handleMessageResponse(payload);
    } else if (isDeliveryReport(payload)) {
      this.logger.log(
        `Webhook DLR reçu — messageId=${payload.messageId} status=${payload.status.value}`,
      );
      this.webhookService.handleOtpTracking(payload);
    }

    return { ok: true };
  }
}
