import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsISO31661Alpha2,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export class UpdateAppConfigDto {
  @ApiPropertyOptional({ default: 300 })
  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(900)
  ttlSeconds?: number;

  @ApiPropertyOptional({ default: 6 })
  @IsOptional()
  @IsInt()
  @Min(4)
  @Max(10)
  codeLength?: number;

  @ApiPropertyOptional({ default: 3 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  maxAttempts?: number;

  @ApiPropertyOptional({ default: 30 })
  @IsOptional()
  @IsInt()
  @Min(0)
  resendCooldown?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  oneTapEnabled?: boolean;

  @ApiPropertyOptional({ type: [String], example: ['FR', 'BE'] })
  @IsOptional()
  @IsArray()
  @IsISO31661Alpha2({ each: true })
  allowedCountries?: string[];

  @ApiPropertyOptional({ default: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  rateLimitPhone?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  rateLimitIp?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  reportEnabled?: boolean;
}
