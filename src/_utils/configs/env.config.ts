import { exit } from 'node:process';
import { Logger } from '@nestjs/common';
import { plainToInstance, Type } from 'class-transformer';
import {
  IsNumber,
  IsString,
  ValidateNested,
  validateSync,
} from 'class-validator';

export class DatabaseConfig {
  @IsString()
  POSTGRES_HOST: string;

  @IsNumber()
  POSTGRES_PORT: number;

  @IsString()
  POSTGRES_USER: string;

  @IsString()
  POSTGRES_PASSWORD: string;

  @IsString()
  POSTGRES_DB: string;
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
      POSTGRES_HOST: config.POSTGRES_HOST,
      POSTGRES_PORT: config.POSTGRES_PORT,
      POSTGRES_USER: config.POSTGRES_USER,
      POSTGRES_PASSWORD: config.POSTGRES_PASSWORD,
      POSTGRES_DB: config.POSTGRES_DB,
    },

    SERVER: {
      NESTJS_PORT: config.NESTJS_PORT,
      NODE_ENV: config.NODE_ENV,
      FRONTEND_URL: config.FRONTEND_URL,
      OTP_API_KEY: config.OTP_API_KEY,
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
