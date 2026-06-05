import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { OTP_APP_REQUEST_KEY, type OtpRequest } from '../guards/api-key.guard';
import { OtpApp } from '../../../generated/prisma/client';

export const CurrentApp = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): OtpApp => {
    const req = ctx.switchToHttp().getRequest<OtpRequest>();
    return req[OTP_APP_REQUEST_KEY];
  },
);
