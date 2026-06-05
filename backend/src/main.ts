import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { useContainer } from 'class-validator';
import {
  EnvironmentVariables,
  ServerConfig,
} from './_utils/configs/env.config';
import { ConfigService } from '@nestjs/config';
import { EnvironnementEnum } from './_utils/enums/environnement.enum';
import { ValidationPipe } from '@nestjs/common';
import ValidationPipeOptionsConfig from './_utils/configs/validation-pipe-options.config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import SwaggerCustomOptionsConfig from './_utils/configs/swagger-custom-options.config';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    forceCloseConnections: true,
  });

  useContainer(app.select(AppModule), { fallbackOnErrors: true });
  const configService = app.get(ConfigService<EnvironmentVariables, true>);
  const serverConfig = configService.get<ServerConfig>('SERVER');
  const port = serverConfig.NESTJS_PORT;
  const nodeEnv = serverConfig.NODE_ENV;
  const isProduction = nodeEnv === EnvironnementEnum.PROD;

  app.set('trust proxy', 1);
  app.useStaticAssets(join(process.cwd(), 'public'));

  app
    .setGlobalPrefix('api/v1')
    .useGlobalPipes(new ValidationPipe(ValidationPipeOptionsConfig));

  const config = new DocumentBuilder()
    .setTitle('Otp sms-mode API')
    .setDescription('Routes description of the sms-mode otp API')
    .setVersion('1.0')
    .addBearerAuth()
    .addApiKey({ type: 'apiKey', name: 'x-api-key', in: 'header' }, 'ApiKey')
    .addSecurityRequirements('ApiKey')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/doc', app, document, SwaggerCustomOptionsConfig);

  app.enableCors({
    ...(isProduction && {
      origin: [serverConfig.FRONTEND_URL],
      credentials: true,
    }),
  });

  app.enableShutdownHooks();

  return app.listen(port);
}
void bootstrap();
