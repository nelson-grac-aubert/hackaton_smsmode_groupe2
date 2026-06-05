import { exit } from 'node:process';
import { Logger } from '@nestjs/common';
import { plainToInstance, Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
  validateSync,
} from 'class-validator';

export class DatabaseConfig {
  @IsString()
  DATABASE_URL: string;
}

export class ServerConfig {
  @IsNumber()
  NESTJS_PORT: number;

  @IsString()
  NODE_ENV: string;

  @IsString()
  FRONTEND_URL: string;

  @IsString()
  OTP_API_KEY: string;

  @IsString()
  @IsOptional()
  OTP_PROVIDER_MODE?: string;

  @IsString()
  PUBLIC_URL: string;

  @IsString()
  @IsOptional()
  PHONE_HMAC_SECRET: string;
}

export class EnvironmentVariables {
  @ValidateNested()
  @Type(() => DatabaseConfig)
  DATABASE: DatabaseConfig;

  @ValidateNested()
  @Type(() => ServerConfig)
  SERVER: ServerConfig;
}

export function validateEnv(config: Record<string, unknown>) {
  const structuredConfig = {
    DATABASE: {
      DATABASE_URL: config.DATABASE_URL,
    },

    SERVER: {
      NESTJS_PORT: config.NESTJS_PORT,
      NODE_ENV: config.NODE_ENV,
      FRONTEND_URL: config.FRONTEND_URL,
      OTP_API_KEY: config.OTP_API_KEY,
      OTP_PROVIDER_MODE: config.OTP_PROVIDER_MODE,
      PUBLIC_URL: config.PUBLIC_URL,
      PHONE_HMAC_SECRET: config.PHONE_HMAC_SECRET,
    },
  };

  const validatedConfig = plainToInstance(
    EnvironmentVariables,
    structuredConfig,
    { enableImplicitConversion: true },
  );

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length) {
    new Logger().error(errors.toString());
    exit(1);
  }

  return validatedConfig;
}
