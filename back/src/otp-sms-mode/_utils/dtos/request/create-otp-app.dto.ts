import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsHexColor,
  IsISO31661Alpha2,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
} from 'class-validator';

export class CreateOtpAppDto {
  @ApiProperty({ example: 'code4sud' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ default: 300, description: 'Validité du code (s)' })
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
  smsFallback?: boolean;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @IsInt()
  @Min(0)
  fallbackAfter?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  oneTapEnabled?: boolean;

  @ApiProperty({ example: 'https://app.code4sud.fr/auth/callback' })
  @IsUrl({ require_tld: false })
  verifyRedirectUrl: string;

  @ApiPropertyOptional({ default: 'Verification', example: 'Nike ✓' })
  @IsOptional()
  @IsString()
  senderLabel?: string;

  @ApiPropertyOptional({ default: '#0F6E56', example: '#111111' })
  @IsOptional()
  @IsHexColor()
  brandColor?: string;

  @ApiPropertyOptional({ example: 'https://cdn.code4sud.fr/logo.png' })
  @IsOptional()
  @IsUrl({ require_tld: false })
  logoUrl?: string;

  @ApiPropertyOptional({ default: 'Code de vérification' })
  @IsOptional()
  @IsString()
  cardTitle?: string;

  @ApiPropertyOptional({
    default: 'Votre code est {{code}}, valable {{ttl}} min.',
  })
  @IsOptional()
  @IsString()
  messageTemplate?: string;

  @ApiPropertyOptional({ default: 'fr', example: 'fr' })
  @IsOptional()
  @IsString()
  locale?: string;

  @ApiPropertyOptional({ type: [String], default: [], example: ['FR', 'BE'] })
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
