import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from '../_utils/configs/env.config';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor(
    private readonly configService: ConfigService<EnvironmentVariables, true>,
  ) {
    const { DATABASE_URL } = configService.get('DATABASE', { infer: true });
    const pool = new Pool({ connectionString: DATABASE_URL });
    super({ adapter: new PrismaPg(pool) });
  }

  async onModuleInit() {
    await this.$connect();
  }
}
